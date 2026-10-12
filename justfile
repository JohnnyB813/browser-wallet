default: firefox 
# build extension for firefox
firefox:
    npm run build 
    npx web-ext build -s build -a dist-firefox --overwrite-dest

# build extension for chrome/chromium (MV3 service worker)
chrome:
    npm run build
    npx web-ext build -s build -a dist-chrome -t chromium --overwrite-dest
