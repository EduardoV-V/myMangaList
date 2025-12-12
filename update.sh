rm -rf dist
npm run build
git add .
git commit -m "Atualizando"
git push -u origin main
npm run deploy
