default: firefox 
# build extension for firefox
firefox:
    npm run build 
    npx web-ext build -s build -a dist-firefox --overwrite-dest
