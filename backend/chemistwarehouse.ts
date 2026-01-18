import axios from 'axios';

export async function fetchProductData(code: string, slug: string) {

  let urlParsed = encodeURIComponent(slug);

  let data = `{"requests":[{"indexName":"prod_cwr-cw-au_products_en_query_suggestions","query":"${slug}","params":"hitsPerPage=5&highlightPreTag=__aa-highlight__&highlightPostTag=__%2Faa-highlight__&clickAnalytics=true"},{"indexName":"prod_cwr-cw-au_products_en","params":"hitsPerPage=3&highlightPreTag=__aa-highlight__&highlightPostTag=__%2Faa-highlight__&query=${urlParsed}&ruleContexts=%5B%22default%22%5D&clickAnalytics=true"}]}`;

  let config = {
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
      'Content-Length': data.length
    },
    data: data
  };



  try {
    const response = await axios.request(config);
    const combinedSug = `${code}-${slug}`;
    for (const result of response.data.results) {
      const product = result.hits.find((p: any) => p.slug.en === combinedSug);
      if (product) {
        console.log(product['prices']['AUD']['priceValues'][0]['customFields']['private-price']['centAmount']);
        let newPrice = 0;
        if(product['prices']['AUD']['priceValues'][0]['customFields']['private-price']['centAmount']){
          newPrice = product['prices']['AUD']['priceValues'][0]['customFields']['private-price']['centAmount'] / 100;
        }else{
          newPrice = product.calculatedPrice / 100;
        }
        return {
          name: product.name.en,
          price: newPrice,
          slug: product.slug.en
        };
      }
    }
  } catch (error) {
    console.error(error);
  }
  return null;



}