// index.js
import express from 'express';
import { handleBestrx } from './controllers/bestrxController.mjs';
import { handlePrimerx } from './controllers/primerxController.mjs';
import { handleBodytrace } from './controllers/bodytraceController.mjs';
import dotenv from 'dotenv';
// dotenv.config();
dotenv.config({ path: '.env' });

const app = express();
const port = process.env.PORT || 4000;


app.use(express.json());

const setBestrxStaticHeader = (req, res, next) => {
    res.setHeader('x-api-key', '1Z_w74XygG||8TWL'); // Replace with your header key-value
    next();
};
const setMicroStaticHeader = (req, res, next) => {
    res.setHeader('x-api-key', 'ZxdVlR24mFCwiAAs'); // Replace with your header key-value
    next();
};

app.post('/api/bestrx', setBestrxStaticHeader, handleBestrx);

app.post('/api/primerx', setMicroStaticHeader, handlePrimerx);
app.post('/api/bodytrace', handleBodytrace);
app.get("/",async (req,res)=>{
	res.send("runeed successfully")
})

// app.listen(port, () => {
//     console.log(`Server running at http://localhost:${port}`);
// });
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
});
