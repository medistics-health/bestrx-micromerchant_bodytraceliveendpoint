import express from 'express';
import { BlobServiceClient } from '@azure/storage-blob';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const accountName = process.env.AZURE_STORAGE_BODYTRACEACCOUNT_NAME;
const apiKey = process.env.AZURE_STORAGE_BODYTRACEACCOUNT_KEY;
const containername = process.env.BODYTRACECONTAINER_NAME;


// Third-party API URL
const THIRD_PARTY_URL = 'https://medical-history-api.ivirahealth.com/api/v1/rpm-readings/createForBodyTrace';
const MEDISTICS_URL =   'https://api.staging.medistics.io/portal/patient-observation';
const MEDISTICS_COOKIE = 'asid=tQ2TNP25NjuZpfvLeOfQVX1B7fc4qHQuBST1aDJiOLYrQH6F4MwtSUd34jGR3sDM';
// Set up Azure Blob Storage Client
const blobServiceClient = BlobServiceClient.fromConnectionString(`DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${apiKey};EndpointSuffix=core.windows.net`);
const containerClient = blobServiceClient.getContainerClient(containername);

// Endpoint to receive data
export const handleBodytrace = async (req, res) => {
    try {
        let data = req.body;
        if (!Array.isArray(data)) {
            data = [data]; // Wrap in an array if it's a single object
        }
        console.log("Received data:", data);
        // Save each record to Azure Blob Storage
        await saveRecordsToBlob(data);
        // Attempt to send data to third-party API
        let thirdPartyResponse = null;
        let medisticsResponse = null;

        try {
            thirdPartyResponse = await sendToThirdParty(data);
            // console.log("Third-party API response:", thirdPartyResponse);
        } catch (error) {
            console.error("Error sending data to third-party:", error.message);
            // Handle the third-party API error gracefully and proceed
        }
        
        try {
            medisticsResponse = await sendToMedistics(data);
        } catch (error) {
            console.error("Error sending to Medistics:", error.message);
        }

        // Send response back
        res.status(200).json({
            message: "Data processed successfully",
            thirdPartyResponse: thirdPartyResponse ? thirdPartyResponse.data : null,
            medisticsResponse: medisticsResponse ? medisticsResponse.data : null
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
    console.log("All records "+JSON.stringify(records));
    const dateTime = new Date();
    const dateString = dateTime.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeString = dateTime.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS

    // Iterate over each record and upload to Blob Storage
    for (const record of records) {
        const deviceId = records[0].deviceId;
        console.log("Device Id Number " +deviceId)
        // Construct the filename using patient_id and PharmacyNumber
        const fileName = `${deviceId}_${timeString}.json`;
        const folderName = `${dateString}`; // Use today's date as the folder name
        const blobName = `${folderName}/${fileName}`; // Full path in blob storage

        // Upload the data to Blob Storage
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const uploadBlobResponse = await blockBlobClient.upload(JSON.stringify(record), Buffer.byteLength(JSON.stringify(record)));

        console.log(`Data uploaded to blob storage with name: ${blobName}`);
    }
}

// Send data to third-party API endpoint
// ========================
// SEND TO FIRST THIRD-PARTY API
// ========================
async function sendToThirdParty(data) {
    if (Array.isArray(data)) {
        data = data[0];
    }

    try {
        console.log("Sending to third-party:", JSON.stringify(data));

        const response = await axios.post(THIRD_PARTY_URL, data, {
            headers: { 'Content-Type': 'application/json' }
        });

        return response;
    } catch (error) {
        console.error("Error sending to third-party:", error.message);

        if (error.response) {
            console.error("Third-party Response:", error.response.data);
        }

        throw new Error("Third-party API call failed.");
    }
}

// ========================
// SEND TO MEDISTICS API
// ========================
async function sendToMedistics(data) {
    if (Array.isArray(data)) {
        data = data[0];
    }

    try {
        console.log("Sending to Medistics:", JSON.stringify(data));

        const response = await axios.post(
            MEDISTICS_URL,
            data,
            {
                headers: {
                    "Content-Type": "application/json",
                    "Cookie": MEDISTICS_COOKIE
                }
            }
        );

        return response;
    } catch (error) {
        console.error("Error sending to Medistics:", error.message);

        if (error.response) {
            console.error("Medistics Response:", error.response.data);
        }

        throw new Error("Medistics API call failed.");
    }
}