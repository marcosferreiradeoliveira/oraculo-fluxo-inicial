import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractTextFromPdf(file: File): Promise<string> {
  const fileReader = new FileReader();

  return new Promise((resolve, reject) => {
    fileReader.onload = async (event) => {
      if (!event.target?.result) {
        reject(new Error('Failed to read file.'));
        return;
      }

      try {
        const typedarray = new Uint8Array(event.target.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');
          fullText += pageText + '\n\n';
        }

        resolve(fullText);
      } catch (error) {
        console.error('Error processing PDF:', error);
        reject(new Error('Could not process the PDF file. It might be corrupted or protected.'));
      }
    };

    fileReader.onerror = () => {
      reject(new Error('An error occurred while reading the file.'));
    };

    fileReader.readAsArrayBuffer(file);
  });
}
