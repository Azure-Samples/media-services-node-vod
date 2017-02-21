---
services: media-services
platforms: node
author: msonecode
---


# Video on Demand in Azure Media Services with AngularJS and NodeJS

## Introduction:

When using Azure Media Services to deliver videos on demand, you have to first upload the content to the Azure Storage associated with the Media Services account. This includes several requests to Azure Media Services to create an asset, an asset file, a write permission access policy and a locator. The locator contains a SAS URL with write access which the client can use to upload the video to storage. If you're running a VOD website, the "client" to Azure Media Services is usually your web server, in which case when the user of your website publishes a video, the video is sent from his/her device to the web server first, then the web server passes it on to the storage. 

It would be more efficient though, to upload video from the end device to storage directly without the web server acting as an intermediate. An approach is to send the SAS URL to the device then use javascript to put the video to storage. This example demonstrates this flow and implements it with AngularJS, NodeJS and MongoDB. It has very basic CRUD operations and simple playback with Azure Media Player as well.

## Prerequisites:

***1. Azure Media Services account***

Get the Account Name and Primary Key from portal.azure.com > Media Services > Account Keys. They will be used as Client ID and Client Secret.

***2. Streaming Endpoint.***

Ensure you have a streaming endpoint enabled in portal.azure.com > Media Services > Streaming endpoints.

***3. MongoDB***

This sample application uses MongoDB to store asset ID, streaming URL, thumbnail and other information. If you don't have one yet, you may get a free one from [mlab](https://mlab.com/).

***4. Enable CORS for the Storage Account associated with Media Services***

The easiest way is to use [Azure CLI](https://github.com/Azure/azure-cli).

`azure storage cors set -a "{YOUR-STORAGE-ACCOUNT}" -k "{STORAGE-ACCOUNT-KEY}" --blob --cors "[{\"AllowedOrigins\":\"*\",\"AllowedMethods\":\"GET,POST,PUT,OPTIONS\",\"MaxAgeInSeconds\":\"86400\",\"AllowedHeaders\":\"*\",\"ExposedHeaders\":\"*\"}]" --verbose`

## Application Flow:

AngularJS  ------------------  NodeJS  ------------------  Azure Media Services
 

&emsp;&emsp;|---- upload request ---->|

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|---------- create asset --------->|

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|------- create asset file -------->| 

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|-- create write access policy --->|

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|-------- create locator --------->|

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|<----------- SAS URL ------------|

&emsp;&emsp;|<------- SAS URL -------|

&emsp;&emsp;|---------------------------------------------- video ----------------------------------> Azure Blob Storage

&emsp;&emsp;|---- encode request --->|

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|------- update asset file ------->|

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|-- delete write access policy --->|

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|--------- delete locator -------->|

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|--------- encode video -------->|

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|------ check encode status ---->|

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|<------- encode finished --------|

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|-- create read access policy --->|

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|--------- create locator -------->|

&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;|<-------- streaming url ----------|

&emsp;&emsp;|<----- streaming url -----|

&emsp;&emsp;|------------------------- playback ------------------------>|

## Run the sample:

***1. Set up config.js.***

- db: MongoDB connection string
- client_id: Azure Media Services Account Name
- client_secret: Azure Media Services Account Key

***2. Start the application.***

- npm install
- bower install
- node bin/www


## Notes:

This sample doesn't implement a layer of access control or user session. 

The maximum size of upload file is set to 100 MBytes. The download locator is set to expire after 43200 minutes (30 days).

## References:

- [Get started with delivering content on demand using REST](https://docs.microsoft.com/en-us/azure/media-services/media-services-rest-get-started).

- Referred the code of [this repo](https://github.com/fritzy/node-azure-media) for some Media Services REST API operations in NodeJS.
