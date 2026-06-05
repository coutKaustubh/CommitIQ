# Why did we use ngrok initially and then deployed further

Part 1 — ngrok kyun chahiye? (problem → solution)

Problem: GitHub tumhare laptop ko directly nahi pahunch sakta

Tumhara Django:  http://127.0.0.1:8000   (sirf tumhari machine)
GitHub servers:  internet pe (USA/cloud)

git push → GitHub webhook configured as:
  POST http://127.0.0.1:8000/api/webhooks/github/
  → FAIL (GitHub cannot reach your localhost)


Yeh API key / OAuth se fix nahi hota — OAuth se tum GitHub ko call karte ho; webhook mein GitHub tumhe call karta hai. Caller ke paas public HTTPS URL hona zaroori ha

