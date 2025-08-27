rm -rf dist
npm run build
git add .
git commit -m "atualizando"
git push -u origin main
npm run deploy
