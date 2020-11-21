export BASE_DIR=/home/u584258542
export NODEJS_HOME=$BASE_DIR/node-latest-install/node-v10.15.0-linux-x64/bin
export PATH=$NODEJS_HOME:$PATH

echo STARTING: $(date '+%Y %b %d %H:%M')

node --version
npm --version

npm config set prefix $BASE_DIR/.npm-packages

cd $BASE_DIR/cron/covid2

node $BASE_DIR/cron/covid2/update.js

npm run tidy-ltla
npm run tidy-msoa

cp $BASE_DIR/cron/covid2/data-ltla.json $BASE_DIR/public_html/covid2/data-ltla.json
cp $BASE_DIR/cron/covid2/data-msoa.json $BASE_DIR/public_html/covid2/data-msoa.json

npm run minify-ltla
npm run minify-msoa

echo END: $(date '+%Y %b %d %H:%M')