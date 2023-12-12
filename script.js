require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const csv = require('fast-csv');
const csvParser = require('csv-parser');

const uri = process.env.MONGO_URI;

const aggregationPipeline = require('./aggregate');

const client = new MongoClient(uri);

async function runAggregationAndDownloadCSV() {
    try {
        await client.connect();
        console.log('Connected to MongoDB successfully');

        const database = client.db('production');
        const collection = database.collection('tasks');

        const result = await collection.aggregate(aggregationPipeline).toArray();

        const uniqueStatusKeys = Array.from(new Set(result.flatMap(obj => Object.keys(obj.status))));

        // Convert array of objects to CSV format
        const csvData = result.map(obj => {
            const row = [
                obj.overdue_user,
                obj.unassignedCount,
                obj.totalcreatedyesterday,
                obj.totalupdatedyesterday,
                obj.overDueOverall,
                obj.WorkspaceID,
                obj.user,
            ];
            // const csvData = result.map(obj => {
            //     const row = [
            //         ...Object.values(obj), // Use Object.values to get an array of values from the object
            //     ];

            // Flatten the status property dynamically
            uniqueStatusKeys.forEach(key => {
                row.push(obj.status[key] || 0); // Default value if undefined
            });

            return row.join(','); // Join the array elements with commas to create a CSV row
        });

        const csvHeader = ['overdue_user', 'unassignedCount', 'totalcreatedyesterday', 'totalupdatedyesterday', 'overDueOverall', 'WorkspaceID', 'user', ...uniqueStatusKeys];
        const csvContent = [csvHeader.join(','), ...csvData].join('\n');

        // Write CSV content to file
        const csvFilePath = 'output.csv';
        fs.writeFileSync(csvFilePath, csvContent);

        console.log('CSV file generated successfully');

        // Sort and manipulate column order
        const inputFilePath = csvFilePath;
        const outputFilePath = 'output.csv';
        const sortByColumn = 'WorkspaceID';
        const rows = [];

        fs.createReadStream(inputFilePath)
            .pipe(csvParser())
            .on('data', (row) => {
                rows.push(row);
            })
            .on('end', () => {
                rows.sort((a, b) => a[sortByColumn].localeCompare(b[sortByColumn]));

                const columnOrder = ['unassignedCount', 'totalcreatedyesterday', 'totalupdatedyesterday', 'overDueOverall', 'WorkspaceID', 'user', 'overdue_user', 'todo', 'inProgress', 'inReview', 'done', 'onHold'];

                const rearrangedRows = rows.map((row) => {
                    const rearrangedRow = {};
                    columnOrder.forEach((column) => {
                        rearrangedRow[column] = row[column];
                    });
                    return rearrangedRow;
                });

                csv.writeToPath(outputFilePath, rearrangedRows, { headers: true })
                    .on('finish', () => {
                        console.log('CSV sorted and saved successfully with manipulated column order!');
                    })
                    .on('error', (err) => {
                        console.error('Error writing to CSV:', err);
                    });
            });


    } finally {
        await client.close();
        console.log('Connection to MongoDB closed');
    }
}

runAggregationAndDownloadCSV().catch(console.error);
