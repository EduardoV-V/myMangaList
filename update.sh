rm -rf dist
npm run build
git add .
git commit -m "Adicionando contabilização de gastos totais"
git push -u origin main
npm run deploy
