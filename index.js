const express = require('express');
const app = express();
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const puppeteer = require('puppeteer');

const url = 'https://jobs.dou.ua/companies/'; //choice your company

const server = app.listen(3000, (err)=>{
    if(err) return err;
});

(async () => {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 0});
    await page.type('#container > div.header > div.b-sub-head-n > div.b-jobs-search > form > input.company', 'Харьков'); //some active - find city
    await page.keyboard.press('Enter');
    await page.waitFor(3000); //waite time for page loading

    await (async function(){ 
        for(;;){
            try{
                await page.click('#companiesListId > div > a'); //some active - click button
                await page.waitFor(3000); //waite time for page loading
            }catch (e) {
                break;
            }
        }
    }());

    let listLinkCompanies = await page.evaluate(()=>{
        let data= [];
        let elementsA = document.querySelectorAll('#companiesListId > ul > li > div'); //choice element
        let elementsB = document.querySelectorAll('#companiesListId > ul > div');

        for (let element of elementsA){
            let title = element.querySelector('div.ovh > div.h2 > a').innerText;
            let src = element.querySelector('div.ovh > div.h2 > a').href;

            data.push({title, src});
        }
        for (let element of elementsB){
            let title = element.querySelector('div.ovh > div.h2 > a').innerText;
            let src = element.querySelector('div.ovh > div.h2 > a').href;

            data.push({title, src});
        }
        return data; //return all link companies on our request
    });
    await browser.close(); //close browser

    const allCompanyData = [];
    for(let i = 0; i < listLinkCompanies.length; i++){
        try{
            console.log(`company: ${i}`);
            let data = await parse(`${listLinkCompanies[i].src}/offices/`);
            if(data === null){
                continue;
            }
            allCompanyData.push(data);
        }catch(e){
            throw e;
        }
    }

    fs.writeFileSync('./allCompanyData.json', JSON.stringify(allCompanyData), 'utf-8'); //all data that needs us 
    server.close(); //stop server
})();


async function parse (url) { //
    const finalData = await axios(url)
        .then(response => {
            const html = response.data;
            const $ = cheerio.load(html);
            const dataCities = $('#container > div.g-company-wrapper > div.table.m-db > div.row.m-db > div.cell.m-db > div > div');
            const data = [];
            const cities = [];

            let title = $('#container > div.g-company-wrapper > div.b-company-head > div > h1').text().replace(/\s{2,}/g, ' ');
            let srcImg = $('#container > div.g-company-wrapper > div.b-company-head > div > img').attr('src');
            let people = $('#container > div.g-company-wrapper > div.b-company-head > div').clone().children().remove().end().text().replace(/[^.0-9]/gim, '');
            let site = $(`#container > div.g-company-wrapper > div.b-company-head > div > div.site > a`).attr('href');
            let urlDOU = url;

            srcImg = srcImg === undefined ? '/' : srcImg;
            people = people.length === 0 ? '0' : people;
            site = site === undefined ? '/' : site;

            dataCities.each(function () {
                const city = $(this).find(' h4 ').text();
                const mail = $(this).find('div > div.row.m-db > div:nth-child(1) > div > div > div.mail').text().replace(/\s{2,}/g, ' ');
                const phones = $(this).find('div > div.row.m-db > div:nth-child(1) > div > div > div.phones').text().replace(/\s{2,}/g, ' ');

                cities.push({
                    city,
                    mail,
                    phones
                })
            });

            data.push({
                title,
                srcImg,
                people,
                site,
                urlDOU,
                cities
            });

            return data;
        })
        .catch(e=> {
            return null;
        });

    return finalData;
}
