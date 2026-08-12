import express from 'express';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;
const appDir = path.join(process.cwd(), 'app');

app.use(express.json());
app.use(express.static(appDir));

app.get('*', (req, res) => {
  const requestedPath = req.path;
  if (requestedPath !== '/' && !path.extname(requestedPath)) {
    const possibleHtmlFile = path.join(appDir, requestedPath + '.html');
    if (fs.existsSync(possibleHtmlFile)) {
      return res.sendFile(possibleHtmlFile);
    }
  }
  
  const targetFile = path.join(appDir, requestedPath);
  if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
    return res.sendFile(targetFile);
  }

  res.sendFile(path.join(appDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

