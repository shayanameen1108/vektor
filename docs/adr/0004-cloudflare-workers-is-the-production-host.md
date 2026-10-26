# Cloudflare Workers is the production host

Production is Cloudflare Workers at https://vektorhq.co.za, deployed by GitHub Actions from `main` only after check passes. The Worker is not connected to Git, and a remote D1 migration is a separate command from the deploy. Workers Builds was rejected because it shipped `main` whether or not the tests had passed.
