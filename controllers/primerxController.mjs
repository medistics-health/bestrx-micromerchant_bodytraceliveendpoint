import express from 'express';
import { BlobServiceClient } from '@azure/storage-blob';
import axios from 'axios';
import dotenv from 'dotenv';


const accountName = process.env.AZURE_STORAGE_PRIMERXACCOUNT_NAME;
const apiKey = process.env.AZURE_STORAGE_PRIMERXACCOUNT_KEY;
const containername = process.env.PRIMERXCONTAINER_NAME;


// Third-party API URL
// const THIRD_PARTY_URL = 'https://clinicalelig-node.medistics.io/upload/uploadMicromerchant';
const THIRD_PARTY_URL = 'https://api.medistics.health/api/micromerchant';
// const THIRD_PARTY_URL = 'https://api.staging.medistics.io/api/micromerchant';


// Set up Azure Blob Storage Client
const blobServiceClient = BlobServiceClient.fromConnectionString(`DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${apiKey};EndpointSuffix=core.windows.net`);
const containerClient = blobServiceClient.getContainerClient(containername);

// Endpoint to receive data
export const handlePrimerx = async (req, res) => {
    try {
        let data = req.body;
        if(!data)
            return res.status(422).json({
                message: "Unprocessable entity",
            });
        res.status(200).json({
            message: "Data received successfully.",
        });
        setImmediate(async () => {
            try {
                if (!Array.isArray(data)) {
                    data = [data]; // Wrap in an array if it's a single object
                }
                // console.log("Received data:", data);
                // Save each record to Azure Blob Storage
                
                var status = await saveRecordsToBlob(data);
                if(status)
                   var statusThirdParty = await sendToThirdParty(data);
                    // console.log("Third-party API response:", thirdPartyResponse);
                } catch (error) {
                    console.error("Error sending data to third-party:", error.message);
                    // Handle the third-party API error gracefully and proceed
                }
                status && statusThirdParty? setTimeout(() => {
                    console.log('Background task completed');
                    // You could notify the client via email, push notification, etc.
                  }, 5000)
                  :
                  setTimeout(() => {
                    !status?console.log('Background task Failed due to BlobUpload'):console.log('Background task Failed due to ThirdParty');
                    // You could notify the client via email, push notification, etc.
                  }, 5000)
                    // Simulate task duration (5 seconds)
          });
    } catch (error) {
        console.error("Error processing data:", error);
        res.status(500).json({
            message: "An error occurred while processing the data."
        });
    }
};

// Save all records to Azure Blob Storage with date-wise folder structure
async function saveRecordsToBlob(records) {
    try{
    const dateTime = new Date();
    const dateString = dateTime.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeString = dateTime.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS


    // Iterate over each record and upload to Blob Storage
    for (const record of records) {
        const patientNo = record.Patient?.PatientNo || 'unknown';
        const npiNo = record.Pharmacy?.NPINo || 'unknown';

        // Construct the filename using patient_id and PharmacyNumber
        const fileName = `${patientNo}_${npiNo}_${timeString}.json`;
        const folderName = `${dateString}`; // Use today's date as the folder name
        const blobName = `${folderName}/${fileName}`; // Full path in blob storage

        // Upload the data to Blob Storage
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const uploadBlobResponse = await blockBlobClient.upload(JSON.stringify(record), Buffer.byteLength(JSON.stringify(record)));

        console.log(`Data uploaded to blob storage with name: ${blobName}`);
        return true
    }
    }catch (error) {
        console.log(`Data uploaded to blob storage failed: ${blobName}`);
        return false
    }
}

async function sendToThirdParty(data) {
    try {
        
        if (Array.isArray(data)) {
            data = data[0];
        }
        console.log("Request Data API " + JSON.stringify(data));
        const response = await axios.post(THIRD_PARTY_URL, data, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.PrimerxToken}`
            }
        });
        // console.log("APi response "+JSON.stringify(response.data));
        return response.data?true:false;
    } catch (error) {
        console.error("Error sending data to third-party:", error.message);
        if (error.response) {
            console.error("Response data:", error.response.data);
        }else {
            console.error("General error:", error.message);
        }
        return false
        throw new Error("Third-party API call failed.");
    }
}