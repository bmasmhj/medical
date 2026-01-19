import axios from 'axios';
import { categories } from './apiUrls';

export async function fetchCategoryData(categoryName: string) {

    const category = categories.find((c) => c.name === categoryName);
    if (!category) {
        throw new Error(`Category ${categoryName} not found`);
    }

    let totalPages = 0;

    let config = (page: number) => {
        return {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'https://42np1v2i98-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(4.23.3)%3B%20Browser%3B%20autocomplete-core%20(1.17.2)%3B%20autocomplete-js%20(1.17.2)',
        headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Origin': 'https://www.chemistwarehouse.com.au',
        'Referer': 'https://www.chemistwarehouse.com.au/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'content-type': 'application/x-www-form-urlencoded',
        'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'x-algolia-api-key': '3ce54af79eae81a18144a7aa7ee10ec2',
        'x-algolia-application-id': '42NP1V2I98',
        'Content-Length': category.data.replace('page=0', `page=${page}`).length
        },
            data: category.data.replace('page=0', `page=${page}`)
        }
    };
    const response = await axios.request(config(0));
    totalPages = response.data.results[0].nbPages;

    try {
        for (let i = 1; i < totalPages; i++) {
            const response = await axios.request(config(i));
            console.log('page: ' +response.data.results[0].page);
            console.log('Total Pages: ' +response.data.results[0].nbPages);
            console.log('Per Page: ' +response.data.results[0].hitsPerPage);
            totalPages = response.data.results[0].nbPages;
        }
    } catch (error) {
        console.error(error);
        return null;
    }
}
