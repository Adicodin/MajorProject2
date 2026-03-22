# Overview

- Compiler stamp 2006 year
- PE file 32 bit DLL

![alt text](image.png)

![alt text](image-2.png)

- MS Visual C++ 6.0

Exports : ZippoCrypt

Imports:

![alt text](image-1.png)

- Indicating registry modification, Scanning of files for encryption, Deletion of files i.e., original ones.


Scanning for file extensions
![alt text](image-3.png)
![alt text](image-4.png)

- Chilkat zip identified along with the hardcoded password highlighted

- Mutex created \_zippo_crypter_v1.0_
- Strings also contain:
    - AUTO_ZIP_REPORT.TXT
    - _CRYPT.ZIP : added to encrypted file names
    - ZIPPO_CRYPTOR.ZIP
    - OUR EGOLD ACCOUNT : for ransom payment

- Function for encryption being used

![alt text](image-5.png)

- The core function receives a file path, skips already encrypted files and the ransom note, compresses the target into a password-protected ZIP (_CRYPT_.ZIP) using hardcoded password, overwrites the original file with "Erased by Zippo! GO OUT!!!", then deletes it.

### Sources
- Manual Analysis
- https://hybrid-analysis.com/sample/1571bc6a9bf61e4f7bb4aea4e93fb37b1e6d7442d375b6d3afc5b85b1fbf01c7/69b3c3280dc3fda4cd08660e