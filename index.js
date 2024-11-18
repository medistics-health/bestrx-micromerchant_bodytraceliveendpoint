// index.js
import express from 'express';
import { handleBestrx } from './controllers/bestrxController.mjs';
import { handlePrimerx } from './controllers/primerxController.mjs';
import { handleBodytrace } from './controllers/bodytraceController.mjs';
import dotenv from 'dotenv';
// dotenv.config();
dotenv.config({ path: './.env' });

const app = express();
const port = process.env.PORT || 4000;


app.use(express.json());


app.post('/api/bestrx', handleBestrx);
app.post('/api/primerx', handlePrimerx);
app.post('/api/bodytrace', handleBodytrace);
app.get("/",async (req,res)=>{
	res.send("runeed successfully")
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});