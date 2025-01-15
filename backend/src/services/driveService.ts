import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

export class DriveService {
    private driveClient;

    constructor() {
        try {
            const credentialsString = process.env.GOOGLE_DRIVE_CREDENTIALS;
            if (!credentialsString) {
                throw new Error('GOOGLE_DRIVE_CREDENTIALS not found in environment variables');
            }

            let credentials;
            try {
                credentials = JSON.parse(credentialsString);
            } catch (parseError) {
                console.error('Error parsing GOOGLE_DRIVE_CREDENTIALS:', credentialsString);
                throw new Error('Invalid JSON in GOOGLE_DRIVE_CREDENTIALS');
            }

            if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
                throw new Error('GOOGLE_DRIVE_FOLDER_ID not found in environment variables');
            }

            const auth = new JWT({
                email: credentials.client_email,
                key: credentials.private_key,
                scopes: ['https://www.googleapis.com/auth/drive.file']
            });

            this.driveClient = google.drive({ version: 'v3', auth });
        } catch (error) {
            console.error('Error initializing DriveService:', error);
            throw error;
        }
    }

    async uploadCsv(csvContent: string, fileName: string): Promise<string> {
        try {
            const fileMetadata = {
                name: fileName,
                mimeType: 'application/vnd.google-apps.spreadsheet',
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!]
            };

            const response = await this.driveClient.files.create({
                requestBody: {
                    name: fileMetadata.name,
                    mimeType: fileMetadata.mimeType,
                    parents: fileMetadata.parents
                },
                media: {
                    mimeType: 'text/csv',
                    body: csvContent
                },
                fields: 'id, webViewLink'
            });

            if (response && response.data && response.data.webViewLink) {
                return response.data.webViewLink;
            }
            return '';
        } catch (error) {
            console.error('Error uploading to Drive:', error);
            throw error;
        }
    }
}