import express from 'express';
import { BlobServiceClient } from '@azure/storage-blob';
import axios from 'axios';
import dotenv from 'dotenv';


const accountName = process.env.AZURE_STORAGE_PRIMERXACCOUNT_NAME;
const apiKey = process.env.AZURE_STORAGE_PRIMERXACCOUNT_KEY;
const containername = process.env.PRIMERXCONTAINER_NAME;


// Third-party API URL
const THIRD_PARTY_URL = 'http://patientinfo.data.medisticshealth.com/upload/uploadMicromerchant';

// Set up Azure Blob Storage Client
const blobServiceClient = BlobServiceClient.fromConnectionString(`DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${apiKey};EndpointSuffix=core.windows.net`);
const containerClient = blobServiceClient.getContainerClient(containername);

// Endpoint to receive data
export const handlePrimerx = async (req, res) => {
    try {
        let data = req.body;
        // Ensure that data is an array (even if one record is sent)
        if (!Array.isArray(data)) {
            data = [data]; // Wrap in an array if it's a single object
        }

        console.log("Received data:", data);

        // Save each record to Azure Blob Storage
        await saveRecordsToBlob(data);

        // Send data to third-party API
        // const thirdPartyResponse = await sendToThirdParty(data);

        // console.log("Third-party API response:", thirdPartyResponse);

        // Send the same data back in response
        res.status(200).json({
            message: "Data processed successfully",
            // thirdPartyResponse: thirdPartyResponse.data
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
    }
}

// Send data to third-party API endpoint
async function sendToThirdParty(data) {
    try {
        const response = await axios.post(THIRD_PARTY_URL, data);
        return response;
    } catch (error) {
        console.error("Error sending data to third-party:", error);
        throw new Error("Third-party API call failed.");
    }
}
