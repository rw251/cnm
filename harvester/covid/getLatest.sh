export BASE_DIR=/home/u584258542
export NODEJS_HOME=$BASE_DIR/node-latest-install/node-v10.15.0-linux-x64/bin
export PATH=$NODEJS_HOME:$PATH

echo STARTING: $(date '+%Y %b %d %H:%M')

node --version
npm --version

npm config set prefix $BASE_DIR/.npm-packages

cd $BASE_DIR/cron/covid

mkdir -p temp

wget -O temp/website_timestamp 'https://coronavirus.data.gov.uk/public/assets/dispatch/website_timestamp'

node shouldWeUpdate.js

FILE=temp/DO_IT
if [ -f "$FILE" ]; then

    curl --compressed 'https://coronavirus.data.gov.uk/downloads/maps/msoa_data_latest.geojson' > temp/msoa_data_latest.geojson
    curl --compressed 'https://coronavirus.data.gov.uk/downloads/maps/ltla_data_latest.geojson' > temp/ltla_data_latest.geojson

    node update.js

    rm temp/DO_IT

    cp temp/data-ltla.json $BASE_DIR/public_html/covid/data-ltla.json
    cp temp/data-msoa.json $BASE_DIR/public_html/covid/data-msoa.json

    npm run minify-ltla
    npm run minify-msoa
fi


echo END: $(date '+%Y %b %d %H:%M')