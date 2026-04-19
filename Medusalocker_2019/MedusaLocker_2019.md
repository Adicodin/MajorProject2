# Overview

- PE32 EXE
- Microsoft Visual C/C++

![alt text](image.png)

- Packing details, most of the sample looks unpacked, also we are able to get useful strings and imports.

![alt text](image-1.png)

- This function is the main execution path for Medusa Locker. It performs privilege escalation checks, disables system recovery mechanisms, deletes shadow copies, and then enters an infinite loop (likely to retry encryption or maintain persistence).

- This function is the central controller. It first checks for a GUID mutex.

![alt text](image-4.png)

- It then performs privilege check to determine if running as ADMIN or USER and logs it.

![alt text](image-2.png)

![alt text](image-3.png)

- These anti recovery commands are executed sequentially

![alt text](image-5.png)

- It stops and restarts LanmanWorkstation for network connectivty to propagate through network shares

![alt text](image-6.png)

- Registry changes for EnableLinkedConnections

![alt text](image-11.png)

![alt text](image-12.png)

- For Persistence it writes its directory to HKLM\SOFTWARE\Medusa and creates a scheduled task named svchostt using COM.

- this function obtains the ransomware’s own directory path (stripping the filename). It uses GetModuleFileNameW. So If the executable is C:\Users\mal\medusa.exe, the function returns C:\Users\mal\.

![alt text](image-7.png)

- Writes the malware’s directory into HKLM\SOFTWARE\Medusa as a REG_SZ value named Name. This fails if not running as Admin, which is consistent with the earlier privilege check.

![alt text](image-8.png)

- This function creates a scheduled task using COM. It is called from the main routine with param_1 = L"svchostt" (task name) and param_2 = some process ID/handle. The task is configured to run the ransomware again, providing persistence.

![alt text](image-9.png)

- Create Task scheduler instance

![alt text](image-10.png)

- Uses .encrypted extension 

![alt text](image-13.png)

- We can find the ransom note as well

![alt text](image-14.png)

![alt text](image-15.png)

https://hybrid-analysis.com/sample/dde3c98b6a370fb8d1785f3134a76cb465cd663db20dffe011da57a4de37aa95/613f4135186cc5432070ffcf

https://www.virustotal.com/gui/file/dde3c98b6a370fb8d1785f3134a76cb465cd663db20dffe011da57a4de37aa95/details