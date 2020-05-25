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
    Key: 'pathfinder/allCreatures.json',
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

module.exports.queryByCR = async (event, context, callback) => {
  console.log("Called s3Select");
  const cr = event.pathParameters.crVal;
  const cr2 = event.pathParameters.crVal2;
  const operator = event.pathParameters.operator || '='; //we may need to account for encoding and make a map
  const compareOp = (operator === 'btw') ? `s.crAsNum > ${cr} and s.crAsNum < ${cr2}` : `s.crAsNum ${operator} ${cr}`;
  const query = `SELECT * FROM S3Object s WHERE ${compareOp}`;
  const s3SelectParams = s3SelectParamBuilder(query);
  try {
    const data = await getS3Data(s3SelectParams);
    console.log(`${data.length} monsters found`)
    context.succeed(data);
  } catch (error) {
    context.fail(error);
  }
};
