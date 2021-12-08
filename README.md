# Clever Orc Monster Search

https://www.serverless.com/blog/cicd-for-serverless-part-1/
https://www.serverless.com/blog/cicd-for-serverless-part-2/

Getting started with Lambda isn't hard at all. But if you are shooting for a super simple API you are still left with a lot of boilerplate things and missing pieces to make it really useful. Each which have their own small gotchas. Testing, deployments, API Gateway, cors, staged deployments, database setup, roles, permissions, javascript modules, dependency install, etc. It can still be a decent amount of work to get to something straightforward: A datasource accessible through lambda driven by a restful API written with Javascript with no hoops for pulling in additional js dependencies. Serverless helps you get there without worrying about all that boilerplate.

## Do this first (prerequisites): 
- [Follow Serverless setup guide](https://www.serverless.com/framework/docs/providers/aws/guide/installation/) for 3 things:
    1. Install Node
    1. Install Serverless
    1. Setup AWS - mostly setting up credentials

If you are looking for a first-time guide to serverless and lambda's please check out [this serverless example project](https://github.com/shaefer/serverless_example) first.

## Getting Started
1. Fork the project. 
1. `npm install`
1. Look through the project:
    - **Understand the document we are querying against and the query we are using**
        - Look at `serverless.yml` for the definitions of things going into AWS. 
        - Make sure to check `service`, `region`, and `stage` on the provider entry in `serverless.yml` to your desired otherwise you'll deploy to `us-west-2` and the stage will be named `dev` The first time you create all this in AWS you probably should go look through everything that got created. It is all happening with CloudFormation and it is doing a lot of nice things for you and all the names and such are coming from the serverless.yml file and are under your control.
1. Run it locally `serverless invoke local --function monsterSearch --path test/shaefer/getCR15.json` This is like hitting your lambda live with the earlier mentioned URI. 
1. Run `serverless deploy` to create the lambda and dynamodb table in AWS. The output for the deploy will show success and give you the url for the deployed API gateway endpoint that you can hit to test it live.
1. *OPTIONAL BUT IMPORTANT*: If you forgot something and want to rollback...**BEFORE** you change anything in the serverless.yml just run a `serverless remove` and it will delete all the resources it just created...or try to. Since serverless created everything with Cloudformation it can remove it too. Find more details in the [serverless docs](https://www.serverless.com/framework/docs/providers/aws/cli-reference/remove/).

https://docs.aws.amazon.com/AmazonS3/latest/API/API_SelectObjectContent.html
https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-lambda-function.html


## Gotchas (things to watch out for):
1. I had forgotten to stringify the body of my response which causes an error (not in the lambda) but in the API Gateway layer which prevented any lambda logging from picking it up. 
1. I tried to setup a path structure that had optional path parameters, but if you don't map those paths in serverless.yml as part of the function you won't get the appropriate api gateway mappings and you will get the very helpful error `internal server error` If you go into api gateway and run the same request you will get a better error `AWS lambda api gateway error “Malformed Lambda proxy response”` which points to the problem and allowed [Stack Overflow](https://stackoverflow.com/a/44702461/1310765) to save the day again.

## Resources
1. [AWS Lambda Function Definitions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-lambda-function.html) (helpful for making specific changes to the lambda config)
1. [S3 Reference](https://docs.aws.amazon.com/AmazonS3/latest/API/API_SelectObjectContent.html) for `SelectObjectContent` which is the call we make when using s3Select (but just uses permissions `getObject`)


## Refresher
This project makes it easy to build and deploy a simple serverless api using lambda and api gateway. 

### The parts
1. There is a source data file in s3...it isn't created as part of this project. 
1. It creates the api gateway which will have a url which is discoverable by going to the deployed stage: https://amazonapigatewayuri/apigatewaystage/api/monsters/cr/13/btw/15
1. The serverless.yml file defines the uri as well as the path to the s3 bucket with the raw data.
1. The function name is not part of the uri...it more like the name of the API domain. 
    1. What is important is the handler `handler: src/cleverorc/monsterSearch.queryByCR` it is the name of the .js file and the method that will be executed from lambda. 
    2. In this case `src/monsterSearch.js` and the function `queryByCR` (which you should notice is formed like a lambda...because it is) 
1. The next part of the uri is the stage (the api gateway stage-used for deployment stages like dev, test, or prod). Then the defined paths in serverless.yml



