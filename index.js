const { default: axios } = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar }  = require('tough-cookie');
const { Client } = require('pg');
const express = require('express');
const cheerio = require('cheerio');
const readline = require('readline');
const process = require("process");
const { url } = require('inspector');
const app = express()
const port = 5000;

const jar = new CookieJar();
const clients = wrapper(axios.create({ jar }));

const connectPg = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'scrape_kpu',
    password: 'postgres',
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
    // console.log(result);
    const regex = /<[^>]*>/g; // This regex matches all HTML tags
    const html = result.data['data'].toString();
    // console.log(html);
    let dataReplace = html.replace(regex, '');
    const dataConvert = dataReplace.split(",").map(item => item.trim());
    // console.log('dataConvert', dataConvert);

    const candidates = [];
    for (let i = 0; i < dataConvert.length; i++) {
        if (dataConvert[i].startsWith('Partai') && dataConvert[i + 2].startsWith('nomor urut')) {
            const candidate = [
                dataConvert[i],
                dataConvert[i + 1],
                dataConvert[i + 2],
                dataConvert[i + 4],
                dataConvert[i + 5],
                dataConvert[i + 6],
                dataConvert[i + 7],
                dataConvert[i + 8],
            ];
            candidates.push(candidate);
        }
    }

    const MAX_GELAR = 3
    let sanitizedGelar = candidates.map(item => {
        // index jenis kelamin
        const indexJenisKelamin = item.findIndex(item2 => item2 === 'LAKI - LAKI' || item2 === 'PEREMPUAN')

        return {
            partai: item[0],
            dapil: item[1].replace('Dapil', ''),
            number: item[2].replace('nomor urut', ''),
            name: item[3],
            gelar: item.slice(4, indexJenisKelamin).join(', '),
            gender: item[indexJenisKelamin],
            city: item[indexJenisKelamin + 1]
        }
    })

    // console.log('sanitized', sanitizedGelar);

    for (let i = 0; i < sanitizedGelar.length; i++) {
        await connectPg.query("INSERT INTO caleg (partai, dapil, number, name, gender, city, level_dapil) VALUES ($1, $2, $3, $4, $5, $6, $7)", [
            sanitizedGelar[i].partai,
            sanitizedGelar[i].dapil,
            'No Urut ' + sanitizedGelar[i].number,
            sanitizedGelar[i].name +' '+ sanitizedGelar[i].gelar,
            sanitizedGelar[i].gender,
            sanitizedGelar[i].city,
            'DPRD PROVINSI'
        ]);
        console.log(`Progress: Inserted ${i+1} of ${sanitizedGelar.length}`);
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