export BASE_DIR=/home/u584258542
export NODEJS_HOME=$BASE_DIR/node-latest-install/node-v10.15.0-linux-x64/bin
export PATH=$NODEJS_HOME:$PATH

echo STARTING: $(date '+%Y %b %d %H:%M')

node --version
npm --version

npm config set prefix $BASE_DIR/.npm-packages

cd $BASE_DIR/cron/covid

mkdir -p temp

curl -sI 'https://coronavirus.data.gov.uk/downloads/maps/ltla_data_latest.geojson' | \
    awk -F"[ ,]+" 'BEGIN{IGNORECASE=1}/last-modified:/{for (i=2; i<=NF; i++)  printf $i " "}' \
    > temp/ltla_last_updated
curl -sI 'https://coronavirus.data.gov.uk/downloads/maps/msoa_data_latest.geojson' | \
    awk -F"[ ,]+" 'BEGIN{IGNORECASE=1}/last-modified:/{for (i=2; i<=NF; i++)  printf $i " "}' \
    > temp/msoa_last_updated

node shouldWeUpdate.js

LTLAFILE=temp/DO_LTLA
if [ -f "$LTLAFILE" ]; then
    curl --compressed 'https://coronavirus.data.gov.uk/downloads/maps/ltla_data_latest.geojson' > temp/ltla_data_latest.geojson
    node update-ltla.js
    rm temp/DO_LTLA
    cp temp/data-ltla.json ../../public_html/covid/data-ltla.json
    npm run minify-ltla
fi

MSOAFILE=temp/DO_MSOA
if [ -f "$MSOAFILE" ]; then
    curl --compressed 'https://coronavirus.data.gov.uk/downloads/maps/msoa_data_latest.geojson' > temp/msoa_data_latest.geojson
    node update-msoa.js
    rm temp/DO_MSOA
    cp temp/data-msoa.json ../../public_html/covid/data-msoa.json
    npm run minify-msoa
fi


echo END: $(date '+%Y %b %d %H:%M')