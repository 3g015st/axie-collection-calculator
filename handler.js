"use strict";

const AWS = require("aws-sdk");
const axios = require("axios");
const { GoogleSpreadsheet } = require("google-spreadsheet");

const SSMClient = new AWS.SSM({
  region: "ap-east-1",
});

const { from, of, throwError, zip, Observable } = require("rxjs");
const {
  concatMap,
  mergeAll,
  mergeMap,
  tap,
  catchError,
  map,
  reduce,
  mapTo,
} = require("rxjs/operators");

const SSM_PS_AXIE = `/axie`;

const SSM_PARAMS_NAME = {
  RONIN_ADDRESS: `${SSM_PS_AXIE}/ronin-addresses`,
  API_KEY_RAPIDAPI: `${SSM_PS_AXIE}/api-key-rapid-api`,
  GOOGLE_API_CLIENT_EMAIL: `${SSM_PS_AXIE}/google-api-client-email`,
  GOOOGLE_API_PRIVATE_KEY: `${SSM_PS_AXIE}/google-api-private-key`,
  GOOGLE_SHEET_ID: `${SSM_PS_AXIE}/google-sheet-id`,
};

let CONFIG = {};

const STATUS_CODES = {
  GENERIC_FAILED: -99,
  GENERIC_SUCCESS: 99,
};

const today = new Date();
const currentMonth = today.getFullYear();
const currentYear = today.getMonth() + 1;

const subscriber = (lambdacb) => ({
  next(value) {
    // console.log("Subscriber - next: ", value);
    lambdacb(null, { status: STATUS_CODES.GENERIC_SUCCESS, msg: value });
  },
  error(err) {
    //console.log("Subscriber - err: ", err);
    lambdacb(Error(err));
  },
});

const isValidSSMParams = (params) =>
  params && Array.isArray(params) && params.length !== 0;

const getAxieDetailsUsingRoninAddress$ = (roninAddress) => {
  const apiKeyRapidApi = CONFIG[SSM_PARAMS_NAME.API_KEY_RAPIDAPI].Value;

  const opts = {
    method: "GET",
    url: `https://axie-infinity.p.rapidapi.com/get-axies/${roninAddress}`,
    headers: {
      "x-rapidapi-key": apiKeyRapidApi,
    },
  };

  return from(axios.request(opts)).pipe(
    map((response) => response.data.data.axies.results),
    mergeAll(),
    mergeMap((axie) =>
      of({
        id: axie.id,
        roninAddress,
        classes: [axie.class],
        parts: axie.parts.reduce((acc, part) => {
          const EXCLUDED_PARTS = {
            ["Eyes"]: true,
            ["Ears"]: true,
          };
          if (!EXCLUDED_PARTS[part.type]) {
            acc.push(part.id);
          }
          return acc;
        }, []),
      })
    ),
    catchError((err) => {
      const v = `getAxieDetailsUsingRoninAddress$ err - ${err}`;
      return throwError(v);
    })
  );
};

const getAxieFloorPriceUsingAxieInfo$ = ({
  id,
  roninAddress,
  ...axiestats
}) => {
  const opts = {
    method: "POST",
    url: "https://graphql-gateway.axieinfinity.com/graphql",
    data: {
      operationName: "GetAxieBriefList",
      variables: {
        owner: null,
        from: 0,
        size: 24,
        sort: "PriceAsc",
        auctionType: "Sale",
        criteria: axiestats,
      },
      query:
        "query GetAxieBriefList($auctionType: AuctionType, $criteria: AxieSearchCriteria, $from: Int, $sort: SortBy, $size: Int, $owner: String) {\n  axies(auctionType: $auctionType, criteria: $criteria, from: $from, sort: $sort, size: $size, owner: $owner) {\n    total\n    results {\n      ...AxieBrief\n      __typename\n    }\n    __typename\n  }\n}\n\nfragment AxieBrief on Axie {\n  id\n  name\n  stage\n  class\n  breedCount\n  image\n  title\n  battleInfo {\n    banned\n    __typename\n  }\n  auction {\n    currentPrice\n    currentPriceUSD\n    __typename\n  }\n  parts {\n    id\n    name\n    class\n    type\n    specialGenes\n    __typename\n  }\n  __typename\n}\n",
    },
  };

  const buildMarketplaceLink = (axieid) =>
    `https://marketplace.axieinfinity.com/axie/${axieid}/`;

  const transformAxieData$ = (flooraxie) => {
    const usdfloorprice = flooraxie.auction.currentPriceUSD;
    const floorid = flooraxie.id;
    return of({
      roninAddress,
      price: parseFloat(usdfloorprice),
      marketplace: buildMarketplaceLink(id),
      floormarketplace: buildMarketplaceLink(floorid),
    });
  };

  return from(axios.request(opts)).pipe(
    concatMap((response) =>
      response.data.data.axies.results.length !== 0
        ? transformAxieData$(response.data.data.axies.results[0])
        : of({
            marketplace: buildMarketplaceLink(id),
            roninAddress,
            price: 0,
            floormarketplace: null,
          })
    ),
    catchError((err) => {
      const v = `getAxieFloorPriceUsingAxieInfo$ err - ${err}`;
      return throwError(v);
    })
  );
};

const buildSpreadsheetFormat$ = (acc, axiePriceDetails) => {
  acc.axies.push(axiePriceDetails);
  acc.total.axies++;
  acc.total.usd += axiePriceDetails.price;
  return acc;
};

const writeToGoogleSheet$ = (axieMap) => {
  console.log("a");
  const sheetNameAxiesPrice = `AXIE_COLLECTION_CALCULATION_AXIES_${currentMonth}_${currentYear}`;
  const sheetNameAxiesTotal = `AXIE_COLLECTION_CALCULATION_AXIESTOTAL_${currentMonth}_${currentYear}`;

  const sheetAxiesPriceConfig = {
    title: sheetNameAxiesPrice,
    headerValues: ["roninAddress", "marketplace", "floormarketplace", "price"],
  };

  const sheetAxiesTotalConfig = {
    title: sheetNameAxiesTotal,
    headerValues: ["usd", "axies"],
  };

  const addAndPopulateSheet$ = (document, sheetConfig, data) =>
    from(document.addSheet(sheetConfig)).pipe(
      concatMap((sheet) =>
        data && Array.isArray(data)
          ? from(sheet.addRows(data))
          : from(sheet.addRow(data))
      )
    );

  const initiateDocument$ = new Observable(async (subscriber) => {
    const doc = new GoogleSpreadsheet(
      CONFIG[SSM_PARAMS_NAME.GOOGLE_SHEET_ID].Value
    );

    console.log("b");

    await doc.useServiceAccountAuth({
      client_email: CONFIG[SSM_PARAMS_NAME.GOOGLE_API_CLIENT_EMAIL].Value,
      private_key: CONFIG[
        SSM_PARAMS_NAME.GOOOGLE_API_PRIVATE_KEY
      ].Value.replace(/\\n/g, "\n"),
    });

    console.log("c");

    subscriber.next(doc);

    console.log("d");
    subscriber.complete();
  });

  return initiateDocument$.pipe(
    tap((_) => console.log("e")),
    concatMap((document) =>
      document
        ? zip(
            addAndPopulateSheet$(
              document,
              sheetAxiesPriceConfig,
              axieMap.axies
            ),
            addAndPopulateSheet$(document, sheetAxiesTotalConfig, axieMap.total)
          )
        : throwError(`Cannot access Google Sheet Document`)
    ),
    tap((_) => console.log("f")),
    mapTo(
      `Your Axie portfolio has been updated ${currentYear} - ${currentMonth}. Please check at this url https://docs.google.com/spreadsheets/d/${
        CONFIG[SSM_PARAMS_NAME.GOOGLE_SHEET_ID].Value
      }`
    )
  );
};

const main$ = () => {
  const params$ = from(
    SSMClient.getParametersByPath({
      Path: SSM_PS_AXIE,
      Recursive: true,
      WithDecryption: true,
    }).promise()
  ).pipe(
    concatMap((data) =>
      isValidSSMParams(data.Parameters)
        ? of(
            data.Parameters.reduce((acc, val) => {
              acc[val.Name] = val;
              return acc;
            }, {})
          )
        : throwError(`Invalid AWS Parameter Store parameters`)
    ),
    tap((config) => {
      CONFIG = config;
    })
  );

  const convertRoninAddressStringToArray$ = (roninAddressString) =>
    roninAddressString
      ? of(roninAddressString.replace(/[\s[\]]/g, "").split(","))
      : throwError(`No ronin address string found`);

  return params$.pipe(
    tap((_) => console.log(1)),
    concatMap((data) =>
      convertRoninAddressStringToArray$(
        CONFIG[SSM_PARAMS_NAME.RONIN_ADDRESS].Value
      )
    ),
    tap((_) => console.log(2)),
    mergeAll(),
    mergeMap(getAxieDetailsUsingRoninAddress$, 3),
    mergeMap(getAxieFloorPriceUsingAxieInfo$, 3),
    reduce(buildSpreadsheetFormat$, { axies: [], total: { usd: 0, axies: 0 } }),
    tap((_) => console.log(3)),
    concatMap(writeToGoogleSheet$),
    tap((_) => console.log(4))
  );
};

module.exports.app = (event, context, callback) => {
  console.log(`Event ${JSON.stringify(event)}`);

  main$().subscribe(subscriber(callback));
};
