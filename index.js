const { default: axios } = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar }  = require('tough-cookie');
const { Client } = require('pg');
const express = require('express');
const cheerio = require('cheerio');
const readline = require('readline');
const process = require("process");
const app = express()
const port = 5000;

const jar = new CookieJar();
const clients = wrapper(axios.create({ jar }));

const connectPg = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'scrape_kpu',
    password: '12345678',
    port: 5432,
})

// Wrap our question within a new function
const question = () => {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Masukan Url Srappernya Selanjutnya: ', (url) => {
      rl.close();
      resolve(url);
    });
  });
};


const getPlayDataCaleg = async () => {
    const url = await question(); // Get user's input using the new function
    let result = await clients.get(url);
    const regex = /<[^>]*>/g; // This regex matches all HTML tags
    const html = result.data['data'].toString();
    let dataReplace = html.replace(regex, '');
    const dataConvert = dataReplace.split(',').map(item => item.trim());

    const candidates = [];
    for (let i = 0; i < dataConvert.length; i++) {
        if (dataConvert[i].startsWith('Partai') && dataConvert[i + 2].startsWith('nomor urut')) {
            const candidate = {
                party: dataConvert[i],
                district: dataConvert[i + 1],
                number: dataConvert[i + 2],
                name: dataConvert[i + 4],
                gender: dataConvert[i + 5],
                gelar: dataConvert[i + 6],
                city: dataConvert[i + 7],
            };
            candidates.push(candidate);

        }
    }

    for (let i = 0; i < candidates.length; i++) {
        await connectPg.query("INSERT INTO caleg (party, district, number, name, gender, gelar, city) VALUES ($1, $2, $3, $4, $5, $6, $7)", [
            candidates[i].party,
            candidates[i].district,
            candidates[i].number,
            candidates[i].name,
            candidates[i].gender,
            candidates[i].gelar,
            candidates[i].city
        ]);
        console.log(`Progress: Inserted ${i+1} of ${candidates.length}`);
    }
    console.log('Done');
    // process.exit(); // Don't exit the process. Instead, ask the user for new input
    getPlayDataCaleg();
}


connectPg.connect(async function (err) {
    if (err) throw err;
    console.log('Connected to database');

    await getPlayDataCaleg();
});

app.listen(port, () => {            //server starts listening for any attempts from a client to connect at port: {port}
    console.log(`Starting Scrapping in ${port}`); 
});