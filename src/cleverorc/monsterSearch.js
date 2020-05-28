const S3 = require('aws-sdk/clients/s3');
const client = new S3({
	region: 'us-west-2'
});

const getS3Data = async (params) => {
  return new Promise((resolve, reject) => {
    client.selectObjectContent(params, (err, data) => {
      if (err) { reject(err); }
      if (!data) {
        reject('Empty data object');
      }

      const records = [] //array of bytes of data to be converted to buffer

      data.Payload.on('data', (event) => {
        if (event.Records) {
          records.push(event.Records.Payload); //THere are multiple events in the eventSTream but we only care about Records. If we have Records we have data.
        }
      })
      .on('error', (err) => {
        reject(err);
      })
      .on('end', () => {
        const rawPlanetString = Buffer.concat(records).toString('utf8'); //bytes to buffer to string
        const planetString = `[${rawPlanetString.replace(/\,$/, '')}]`; //remove trailing commas? //force into json array

        try {
          const planetData = JSON.parse(planetString);
          resolve(planetData);
        } catch (e) {
          reject(new Error(`Unable to convert S3 data to JSON object. S3 Select Query: ${planetString} ${params.Expression} ${e}`));
        }
      });
    });
  });
}

const s3SelectParamBuilder = (query) => {
  const s3SelectParams = {
    Bucket: 'cleverorc',
    Key: 'pathfinder/allMonsters.json',
    ExpressionType: 'SQL',
    Expression: query,
    InputSerialization: {
      JSON: {
        Type: 'DOCUMENT'
      }
    },
    OutputSerialization: {
      JSON: {
        RecordDelimiter: ','
      }
    }
  };
  return s3SelectParams;
}

const mapOperators = (op) => {
  const operator = (op) ? op.toLowerCase() : op;
  const ops = {
    gte: '>=',
    lte: '<=',
    lt: '<',
    gt: '>',
    eq: '='
  }
  return ops[operator] || operator || '=';
}

const http200 = (data) => {
  const response = {
    statusCode: '200',
    body: JSON.stringify(data),
  };
  return response;
}
const http500 = (error) => {
  const response = {
    statusCode: '500',
    body: error,
  };
  return response;
}

const decodeURIPathParameters = (param) => {
  if (!param) return ''; //decodeURI(undefined) returns the string 'undefined' which is very distressing. Same for null. 
  try {
    return decodeURIComponent(param);
  } catch (e) {
    return '';
  }
}

const convertCRToDecimal = (cr) => {
  const decoded = decodeURIComponent(cr);
  if (decoded === '1/2') return 0.5;
  if (decoded === '1/3') return "cast(0.33 as FLOAT)"; //trying to match these is causing weird bugs probably due to some opaque type casting...
  if (decoded === '1/4') return 0.25;
  if (decoded === '1/6') return "cast(0.166 as FLOAT)";
  if (decoded === '1/8') return "cast(0.125 as FLOAT)";
  return decoded;
}

/**
 * /monsterSearch/cr/{crVal1}/{operator(optional)}/{crVal2(optional)}
 * crVal2 is only used for operator btw
 * operators: <(lt), >(gt), >=(gte), <=(lte), =(eq), btw
 * btw is always inclusive
 */
module.exports.queryByCR = async (event, context, callback) => {
  const cr = convertCRToDecimal(event.pathParameters.crVal); //TODO: Validate Path Params
  const cr2 = convertCRToDecimal(event.pathParameters.crVal2);
  const operator = mapOperators(decodeURIPathParameters(event.pathParameters.operator)); //we may need to account for encoding and make a map

  const uri = (operator === 'btw') ? `/cr/${cr}/${operator}/${cr2}` : `/cr/${cr}/${operator}`;

  const compareOp = (operator === 'btw') ? `s.crAsNum >= ${cr} and s.crAsNum <= ${cr2}` : `s.crAsNum ${operator} ${cr}`;
  const query = `SELECT s.name, s.cr, s.crAsNum, s.alignment, s.environment, s.creature_type, s.creature_subtype, s.ability_scores FROM S3Object s WHERE ${compareOp}`;
  const s3SelectParams = s3SelectParamBuilder(query);
  try {
    const data = await getS3Data(s3SelectParams);
    //TODO: Add meta data to object...like number of results, and what was queried
    console.log(`Data retrieved for: ${uri}`)
    const fullData = {
      monsterCount: data.length,
      uri,
      results: data
    }
    callback(null, http200(fullData)); //API Gateway expects a stringified body back otherwise you'll get an internal error after the lambda is processed.
  } catch (error) {
    callback(null, http500(error));
  }
};
