Cd C:\Users\bradm\Projects\ats-resume-builder
git add *
git commit -m "Fixes"
git push
npm run qa:promote
npm run qa:verify -- --reviewer "Cursor Agent" --approve-all
cd..