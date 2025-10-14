import express from 'express';
import { BlobServiceClient } from '@azure/storage-blob';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config(); // Make sure you load env variables

const accountName = process.env.AZURE_STORAGE_PRIMERXACCOUNT_NAME;
const apiKey = process.env.AZURE_STORAGE_PRIMERXACCOUNT_KEY;
const containerName = process.env.PRIMERXCONTAINER_NAME;
// const THIRD_PARTY_URL = 'https://api.medistics.health/api/micromerchant';
const THIRD_PARTY_URL = 'https://importhistoricaldata.lemonocean-9dfffc9f.centralus.azurecontainerapps.io/api/micromerchant';

// Azure Blob setup
const blobServiceClient = BlobServiceClient.fromConnectionString(
  `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${apiKey};EndpointSuffix=core.windows.net`
);
const containerClient = blobServiceClient.getContainerClient(containerName);

// Main request handler
export const handlePrimerx = async (req, res) => {
  try {
    let data = req.body;

    if (!data) {
      return res.status(422).json({ message: 'Unprocessable entity' });
    }

    if (!Array.isArray(data)) {
      data = [data];
    }

    const blobStatus = await saveRecordsToBlob(data);

    if (!blobStatus) {
      return res.status(500).json({ message: 'Failed to upload data to Azure Blob Storage.' });
    }

    const apiMessage = await sendToThirdParty(data);

    if (typeof apiMessage === 'string') {
      return res.status(200).json({ message: apiMessage });
    } else {
      return res.status(500).json({ message: 'Failed to send data to third-party API.' });
    }
  } catch (error) {
    console.error('❌ Error in handlePrimerx:', error.message);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
};

// Upload all records to Azure Blob Storage
async function saveRecordsToBlob(records) {
  try {
    const now = new Date();
    const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeString = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS

    for (const record of records) {
      const patientNo = record.Patient?.PatientNo || 'unknown';
      const npiNo = record.Pharmacy?.NPINo || 'unknown';

      const fileName = `${patientNo}_${npiNo}_${timeString}.json`;
      const blobName = `${dateString}/${fileName}`;

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const recordString = JSON.stringify(record);

      await blockBlobClient.upload(recordString, Buffer.byteLength(recordString));
      console.log(`✅ Uploaded to Azure Blob: ${blobName}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Blob upload failed:', error.message);
    return false;
  }
}

// Send to third-party API and return their message
async function sendToThirdParty(data) {
  try {
    const record = Array.isArray(data) ? data[0] : data;

    // console.log('📤 Sending to third-party:', JSON.stringify(record, null, 2));

    const response = await axios.post(THIRD_PARTY_URL, record, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PrimerxToken}`
      }
    });

    const message = response.data?.message || 'Success';
    console.log('✅ Third-party API response:', response.status, message);
    return message;
  } catch (error) {
    console.error('❌ Error sending data to third-party:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}
