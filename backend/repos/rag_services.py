"""
RAG services for CommitIQ Ask AI.

Ingest: FileChange.patch + AnalysisIssue → chunk → embed → CodeChunk (pgvector).
Query:  embed question → cosine search → prompt → Groq answer.
"""

from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from pgvector.django import CosineDistance

from .analysis_services import _is_sensitive_file
from .models import AnalysisIssue, CodeChunk, Commit, FileChange

logger = logging.getLogger(__name__)

_embedding_model = None


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------


def recursive_chunk_text(text: str,*,chunk_size: int | None = None, chunk_overlap: int | None = None,) -> list[str]:
    """
    Split long text into overlapping chunks (recursive-style line breaks)
    Small text (<= chunk_size) returns a single chunk.
    Large text (e.g. 700-line markdown) returns multiple chunks with overlap.
    """
    size = chunk_size if chunk_size is not None else settings.RAG_CHUNK_SIZE
    overlap = chunk_overlap if chunk_overlap is not None else settings.RAG_CHUNK_OVERLAP
    body = (text or "").strip() # Remove leading and trailing whitespace
    if not body:
        return []
    if len(body) <= size:
        return [body]

    chunks: list[str] = []
    start = 0
    length = len(body)

    while start < length:
        end = min(start + size, length)
        #why end = min(start + size, length) ?
        #because we don't want to go beyond the length of the body
        #if we go beyond the length of the body, we will get an index error
        #if we go beyond the length of the body, we will get an index error
        if end < length:
            newline = body.rfind("\n", start, end) # Find the last newline character in the chunk
            if newline > start:
                end = newline
                # here we updating the end index to the last newline character in the chunk 
                # because we don't want to split in the middle of a word
                # if we split in the middle of a word, we will get an incomplete word
        piece = body[start:end].strip() # Remove leading and trailing whitespace
        if piece:
            chunks.append(piece)

        if end >= length:
            break

        start = max(end - overlap, start + 1)

    return chunks

"""
ab dekho upar kya hua - 
sbse pehle total size of chunk store kiya in size (may be 800)
fir overlap wala value store kiya in overlap (may be 100)
fir uske bad body me pura text store kiya
and length = pure text ka length
and uske bad loop me end = min of start se 800 dur ya length  kyuki last remaining text ko bhi 
include karna hai (800+800+800+600) toh ye 600 jo h vo aise ayegi bcz 2400+800 will cross total len 
so last end = length lo
usme se last newline character find kia and usko end me store kiya
for eg ab smjho  - agar aisa hua ki end jo h voh kisi char ke end tk nahi h toh (beech me h jaise kaustubh
me kaus yahn pr end h toh usse bdhiya jahan ye line khtm hui wahan tk le lo)
agar to newline start se aage h to utna hissa peice me daal do (start se end tk)
fir chunks vector me store kro us piece ko (chunk 1)
 agar toh end ab pura file ke bahar aagya therefore break
 fir start kro end se thoda pehle (kyuki we need overlap)
 
 return chunks
"""

def _metadata_prefix(*, repository_full_name: str, commit_sha: str,commit_message: str,file_path: str,source_type: str,extra: dict[str, Any] | None = None,) -> str:
    lines = [
        f"repository: {repository_full_name}",
        f"commit_sha: {commit_sha}",
        f"commit_message: {(commit_message or '').split(chr(10))[0][:200]}",
        f"file_path: {file_path or '(none)'}",
        f"source_type: {source_type}",
    ]
    if extra:
        for key, value in extra.items():
            if value is not None and value != "":
                lines.append(f"{key}: {value}")
    lines.append("---")
    return "\n".join(lines)


"""
the above function is used to create a metadata prefix for the diff document, for eg vo 
leta h -
repository: kaustubh/CommitIQ
commit_sha: 1234567890
commit_message: Add new feature
file_path: src/main/java/com/example/MyClass.java
source_type: DIFF
---
and extra me vo data daalte jo h extra hai for eg status, additions, deletions

"""

def build_diff_document(commit: Commit, file_change: FileChange) -> str:
    """Metadata + unified diff patch for one file."""
    prefix = _metadata_prefix(
        repository_full_name=commit.repository.full_name,
        commit_sha=commit.sha,
        commit_message=commit.message,
        file_path=file_change.file_path,
        source_type=CodeChunk.SourceType.DIFF,
        extra={
            "status": file_change.status,
            "additions": file_change.additions,
            "deletions": file_change.deletions,
        },
    )
    return f"{prefix}\n{file_change.patch}"


def build_issue_document(commit: Commit, issue: AnalysisIssue) -> str:
    """Metadata + static analysis finding text."""
    prefix = _metadata_prefix(
        repository_full_name=commit.repository.full_name,
        commit_sha=commit.sha,
        commit_message=commit.message,
        file_path=issue.file_path,
        source_type=CodeChunk.SourceType.ISSUE,
        extra={
            "severity": issue.severity,
            "title": issue.title,
            "line_number": issue.line_number,
        },
    )
    body = "\n".join(
        part
        for part in (
            f"Title: {issue.title}",
            f"Description: {issue.description}",
            f"Suggestion: {issue.suggestion}",
        )
        if part
    )
    return f"{prefix}\n{body}"


# ---------------------------------------------------------------------------
# Embeddings (HuggingFace sentence-transformers / MiniLM)
# ---------------------------------------------------------------------------


def _get_embedding_model():
    """Lazy-load SentenceTransformer once per worker process."""
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        #sentence_transformers is a library for sentence embedding

        logger.info("Loading embedding model: %s", settings.RAG_EMBEDDING_MODEL)
        _embedding_model = SentenceTransformer(settings.RAG_EMBEDDING_MODEL)
    return _embedding_model


def embed_text(text: str) -> list[float]:
    """Single string → embedding vector (list of floats)."""
    vectors = embed_texts([text])
    return vectors[0]

"""
the above function embed_text is used to embed a single text into a vector
how it works - 
first we get the embedding model
then we encode the text into a vector
then we return the vector
"""


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed — same model/dims as stored in CodeChunk.embedding."""
    if not texts:
        return []

    model = _get_embedding_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return [vector.tolist() for vector in embeddings]

#
"""
the above function embed_texts is used to embed a list of texts into a list of vectors
how it works - 
first we get the embedding model
then we encode the texts into a list of vectors
then we return the list of vectors
"""

# ---------------------------------------------------------------------------
# Ingest — FileChange + AnalysisIssue → CodeChunk rows
# ---------------------------------------------------------------------------


def ingest_commit(commit: Commit) -> int:
    """
    Chunk and embed all diff/issue text for one commit.

    Deletes existing chunks for this commit first (idempotent on Celery retry).
    Returns number of CodeChunk rows created.
    """
    repository = commit.repository
    CodeChunk.objects.filter(commit=commit).delete()
#why delete - because we don't want to insert duplicate chunks
    pending: list[tuple[str, str, int, str]] = []
    #pending is a list of tuples, each tuple contains the content, file path, chunk index, and source type
    for file_change in commit.file_changes.all():
        if _is_sensitive_file(file_change.file_path):
            continue
        if not (file_change.patch or "").strip():
            continue

        document = build_diff_document(commit, file_change)
        for chunk_index, piece in enumerate(recursive_chunk_text(document)):
            pending.append(
                (piece, file_change.file_path, chunk_index, CodeChunk.SourceType.DIFF)
            )

    job = getattr(commit, "analysis_job", None)
    if job is not None:
        for issue in job.issues.all():
            document = build_issue_document(commit, issue)
            base_index = issue.id * 1000
            for offset, piece in enumerate(recursive_chunk_text(document)):
                pending.append(
                    (
                        piece,
                        issue.file_path,
                        base_index + offset,
                        CodeChunk.SourceType.ISSUE,
                    )
                )

    if not pending:
        logger.info("rag ingest: no chunks for commit %s", commit.sha[:7])
        return 0

    texts = [row[0] for row in pending]
    vectors = embed_texts(texts)

    CodeChunk.objects.bulk_create(
        [
            CodeChunk(
                repository=repository,
                commit=commit,
                file_path=file_path,
                chunk_index=chunk_index,
                content=content,
                source_type=source_type,
                embedding=vector,
            )
            for (content, file_path, chunk_index, source_type), vector in zip(
                pending, vectors
            )
        ]
    )

    count = len(pending)
    logger.info(
        "rag ingest: %s chunks for commit %s repo %s",
        count,
        commit.sha[:7],
        repository.full_name,
    )
    return count


# ---------------------------------------------------------------------------
# Query — search + prompt + Groq
# ---------------------------------------------------------------------------


def search_similar_chunks(
    repository_id: int,
    question: str,
    *,
    top_k: int | None = None,
) -> list[CodeChunk]:
    """Embed question and return top-K CodeChunk rows by cosine distance."""
    k = top_k if top_k is not None else settings.RAG_TOP_K
    query = (question or "").strip()
    if not query:
        return []

    query_vector = embed_text(query)
    return list(
        CodeChunk.objects.filter(repository_id=repository_id)
        .select_related("commit")
        .annotate(distance=CosineDistance("embedding", query_vector))
        .order_by("distance")[:k]
    )


def build_rag_prompt(
    repository_full_name: str,
    chunks: list[CodeChunk],
    question: str,
) -> str:
    """Assemble the LLM prompt with retrieved context."""
    context_blocks = []
    for index, chunk in enumerate(chunks, start=1):
        context_blocks.append(
            "\n".join(
                (
                    f"--- Chunk {index} "
                    f"(file: {chunk.file_path or 'n/a'}, "
                    f"commit: {chunk.commit.sha[:7]}, "
                    f"type: {chunk.source_type}) ---",
                    chunk.content,
                )
            )
        )

    context = "\n\n".join(context_blocks) if context_blocks else "(no context)"

    return f"""You are CommitIQ, a code analysis assistant for the repository {repository_full_name}.

RULES:
- Answer ONLY using the CONTEXT below.
- If the context does not contain enough information, say you do not have enough indexed data about that yet.
- Cite file paths and commit SHAs when mentioning code.
- Do NOT invent files, functions, or APIs not present in the context.
- Be concise and actionable.

CONTEXT:
{context}

USER QUESTION:
{question.strip()}
"""


def ask_groq(prompt: str) -> str:
    """Call Groq chat completion. Requires GROQ_API_KEY in settings."""
    api_key = (settings.GROQ_API_KEY or "").strip()
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Add it to backend/.env to enable Ask AI answers."
        )

    from groq import Groq

    client = Groq(api_key=api_key)
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    message = response.choices[0].message.content
    return (message or "").strip()


def format_sources(chunks: list[CodeChunk]) -> list[dict[str, str]]:
    """Shape chunk citations for the API / frontend."""
    sources = []
    for chunk in chunks:
        sources.append(
            {
                "file_path": chunk.file_path,
                "commit_sha": chunk.commit.sha,
                "commit_sha_short": chunk.commit.sha[:7],
                "source_type": chunk.source_type,
                "snippet": chunk.content[:400],
            }
        )
    return sources


def ask_repository(repository, question: str) -> dict[str, Any]:
    """
    Full RAG query for one repository.

    Returns:
        { "answer": str, "sources": list[dict], "chunks_used": int }
    """
    chunks = search_similar_chunks(repository.id, question)
    if not chunks:
        return {
            "answer": (
                "I don't have indexed commit data for this repository yet. "
                "Push a commit to a connected repo and wait for analysis to finish."
            ),
            "sources": [],
            "chunks_used": 0,
        }

    prompt = build_rag_prompt(repository.full_name, chunks, question)
    answer = ask_groq(prompt)
    return {
        "answer": answer,
        "sources": format_sources(chunks),
        "chunks_used": len(chunks),
    }
