import express from 'express';
import { BlobServiceClient } from '@azure/storage-blob';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// ENVIRONMENT VARIABLES
const accountName = process.env.AZURE_STORAGE_BESTRXACCOUNT_NAME;
const apiKey = process.env.AZURE_STORAGE_BESTRXACCOUNT_KEY;
const containerName = process.env.BESTRXCONTAINER_NAME;
// const THIRD_PARTY_URL = 'https://clinicalelig-node.medistics.io/upload/uploadBestrx';
// const THIRD_PARTY_URL = 'https://api.staging.medistics.io/api/bestrx';
// const THIRD_PARTY_URL = 'https://api.medistics.health/api/bestrx';
const THIRD_PARTY_URL = 'https://importhistoricaldata.purpledune-ecfe60ec.centralus.azurecontainerapps.io/api/bestrx';

// AZURE BLOB STORAGE SETUP
const blobServiceClient = BlobServiceClient.fromConnectionString(
  `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${apiKey};EndpointSuffix=core.windows.net`
);
const containerClient = blobServiceClient.getContainerClient(containerName);

// EXPRESS HANDLER
export const handleBestrx = async (req, res) => {
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
      return res.status(500).json({ message: 'Failed to upload to Azure Blob Storage.' });
    }

    const apiStatus = await sendToThirdParty(data);

    if (apiStatus && typeof apiStatus === 'string') {
      // If sendToThirdParty returns message
      return res.status(200).json({ message: apiStatus });
    } else if (apiStatus === true) {
      return res.status(200).json({ message: 'Data successfully sent to third-party.' });
    } else {
      return res.status(500).json({ message: 'Failed to send data to third-party API.' });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
};


// ⬇️ SAVE TO BLOB STORAGE
async function saveRecordsToBlob(records) {
  try {
    const now = new Date();
    const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeString = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS

    for (const record of records) {
      const { patient_id, PharmacyNumber } = record;
      const fileName = `${patient_id}_${PharmacyNumber}_${timeString}.json`;
      const blobName = `${dateString}/${fileName}`;

      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      const recordData = JSON.stringify(record);

      await blockBlobClient.upload(recordData, Buffer.byteLength(recordData));
      console.log(`✅ Uploaded to Azure Blob: ${blobName}`);
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to upload to Azure Blob:', error.message);
    return false;
  }
}

// ⬇️ SEND TO THIRD-PARTY API
async function sendToThirdParty(data) {
  try {
    const record = Array.isArray(data) ? data[0] : data;

    const response = await axios.post(THIRD_PARTY_URL, record, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.bestrxToken}`
      }
    });

    const message = response.data?.message || 'Success';
    console.log('✅ Third-party API response:', response.status, message);

    return message; // Return the message string
  } catch (error) {
    console.error('❌ Error sending data to third-party:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

