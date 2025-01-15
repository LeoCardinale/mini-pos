import { config } from 'dotenv';
import { resolve } from 'path';
import { DriveService } from './src/services/driveService';

// Cargar variables de entorno
config({ path: resolve(__dirname, '.env') });

async function test() {
  // Verificar que las variables estén cargadas
  console.log('Checking env variables:');
  console.log('GOOGLE_DRIVE_FOLDER_ID:', process.env.GOOGLE_DRIVE_FOLDER_ID ? 'Present' : 'Missing');
  console.log('GOOGLE_DRIVE_CREDENTIALS:', process.env.GOOGLE_DRIVE_CREDENTIALS ? 'Present' : 'Missing');

  const driveService = new DriveService();
  try {
    const link = await driveService.uploadCsv('test,data\n1,2', 'test.csv');
    console.log('Success:', link);
  } catch (error: any) {
    console.error('Full error:', {
      message: error.message,
      code: error.code,
      errors: error.errors,
      response: error.response?.data
    });
  }
}

test();