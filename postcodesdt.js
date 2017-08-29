const requestPromise = require('request-promise')
const fs = require('fs')
const filendir = require('filendir')
const { Pool } = require('pg')
const postcodes = require('./postcodes/postcodes.js')
const key = require('./key.js');

//////////////////////////////////////////
// Validate postcodes array
////////////////////////////////////////// 

if (!Array.isArray(postcodes)) {
  throw new Error('Postcodes list must be an Array.')
  process.exit(1)
}

//////////////////////////////////////////
// PostgreSQL settings
////////////////////////////////////////// 

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'az_cbc_ptp',
  password: '',
  port: 5432,
})

//////////////////////////////////////////
// Read/Write utility methods 
////////////////////////////////////////// 

const logsPath = __dirname + `/logs/`;

const limit = postcodes.length
let executions = 1
let index = 0
let delaySeconds = 1
const destinations = [
  'CB3 0EX', // P&R Madingley
  'CB2 9FT', // P&R Trumpington
  'CB22 3AB', // P&R Babraham
  'CB21 6GP', // Granta Park
  'CB4 0FZ', // Darwin
  'SG8 6HB', // DaVinci (Melbourn Science Park)
  'CB2 0SL', // CBC
]
const uk_postcode = /([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2})|(([A-Za-z][0-9][A-Za-z])|([A-Za-z][A-Ha-hJ-Yj-y][0-9]?[A-Za-z])))) [0-9][A-Za-z]{2})/

const getData = function self(id) {
  if (id) clearTimeout(id);
  id = setTimeout(function () {
    console.log(executions, postcodes[index])
    let errorFlag = false;
    let errorMsg = '';
    // validate postcode as a string
    if (!(typeof postcodes[index] === 'string')) {
      errorFlag = true;
      errorMsg += `Not a valid string.`
    }

    // remove postcode's spaces
    let unformatted_postcode = postcodes[index].replace(/\s/g, '')

    // validate postcode's length
    if (!errorFlag) {
      if ((unformatted_postcode.length < 5) || (unformatted_postcode.length > 7)) {
        errorFlag = true;
        errorMsg += `Postcode's lenght is not valid.`
      }
    }

    // normalize postcode
    unformatted_postcode = unformatted_postcode.split('');
    unformatted_postcode.splice(-3, 0, ' ');
    const normalized_postcode = unformatted_postcode.join('');

    // check is a valid UK postcode
    if (!errorFlag) {
      if (!uk_postcode.test(normalized_postcode)) {
        errorFlag = true;
        errorMsg += `${normalized_postcode} is not a valid UK postcode.`
      }
    }

    if (errorFlag) {
      fs.appendFileSync('invalid_postcodes.log', `${postcodes[index]}|${errorMsg}|${new Date()}\n`, encoding = 'utf8');
      if (executions < limit) {
        executions++
        index++
        return self(id)
      }
    }
    requestPromise({
      method: `GET`,
      url: `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${normalized_postcode}&destinations=${destinations.join('|')}&region=uk&mode=driving&units=imperial&language=en-GB&key=${key}`,
    }).then(function (data) {
      data = JSON.parse(data);

      const statusErrorCodes = [
        'INVALID_REQUEST',
        'MAX_ELEMENTS_EXCEEDED',
        'MAX_DIMENSIONS_EXCEEDED',
        'REQUEST_DENIED',
        'UNKNOWN_ERROR',
      ]
      const statusError = statusErrorCodes.find(function (errorCode) {
        return errorCode === data.status
      })
      if (statusError) {
        fs.appendFileSync(`${data.status}.log`, `${postcodes[index]}|${data.error_message}|${new Date()}\n`, encoding = 'utf8');
        if (executions < limit) {
          executions++
          index++
          return self(id)
        }
      }
      if (!statusError) {
        if (data.status === 'OVER_QUERY_LIMIT') {
          fs.appendFileSync(`${data.status}.log`, `${postcodes[index]}|${data.error_message}|${new Date()}\n`, encoding = 'utf8');
          process.exit(0)
        }
      }

      const parkandride_madingley_time = data.rows[0].elements[0].duration.value || null
      const parkandride_trumpington_time = data.rows[0].elements[1].duration.value || null
      const parkandride_babraham_time = data.rows[0].elements[2].duration.value || null

      const parkandride_madingley_dis = data.rows[0].elements[0].distance.value || null
      const parkandride_trumpington_dis = data.rows[0].elements[1].distance.value || null
      const parkandride_babraham_dis = data.rows[0].elements[2].distance.value || null

      const car_grantapark_time = data.rows[0].elements[3].duration.value || null
      const car_darwin_time = data.rows[0].elements[4].duration.value || null
      const car_davinci_time = data.rows[0].elements[5].duration.value || null

      const car_grantapark_dis = data.rows[0].elements[3].distance.value || null
      const car_darwin_dis = data.rows[0].elements[4].distance.value || null
      const car_davinci_dis = data.rows[0].elements[5].distance.value || null

      const car_west_time = data.rows[0].elements[6].duration.value || null
      const car_west_dist = data.rows[0].elements[6].distance.value || null

      pool.connect((err, client, release) => {
        if (err) {
          console.error('error fetching client from pool', err);
          fs.appendFileSync(`pg_error.log`, `${postcodes[index]}|${err}|${new Date()}\n`, encoding = 'utf8');
          process.exit(1)
        }
        client.query(`insert into ptp_travel_drive_times 
          (
            post_code,
            parkandride_madingley_time,
            parkandride_trumpington_time,
            parkandride_babraham_time,
            parkandride_madingley_dis,
            parkandride_trumpington_dis,
            parkandride_babraham_dis,
            car_grantapark_time,
            car_darwin_time,
            car_davinci_time,
            car_grantapark_dis,
            car_darwin_dis,
            car_davinci_dis,
            car_west_time,
            car_west_dist
          ) 
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [
            normalized_postcode,
            parkandride_madingley_time,
            parkandride_trumpington_time,
            parkandride_babraham_time,
            parkandride_madingley_dis,
            parkandride_trumpington_dis,
            parkandride_babraham_dis,
            car_grantapark_time,
            car_darwin_time,
            car_davinci_time,
            car_grantapark_dis,
            car_darwin_dis,
            car_davinci_dis,
            car_west_time,
            car_west_dist
          ], (err, result) => {
            //call `done()` to release the client back to the pool
            release()
            if (err) {
              fs.appendFileSync(`query_error.log`, `${postcodes[index]}|${err}|${new Date()}\n`, encoding = 'utf8');
            }
            if (executions < limit) {
              executions++
              index++
              return self(id)
            }
          })
      })
    }).catch(function (error) {
      fs.appendFileSync(`request_error.log`, `${postcodes[index]}|${error}|${new Date()}\n`, encoding = 'utf8');
      if (executions < limit) {
        executions++
        index++
        return self(id)
      }
    })
  }, delaySeconds * 1000)
}
getData()