# Overview

- PE file 32 bit EXE
- Sample compiler 2017

- After successful execution we get ransom note and change in desktop

![alt text](<Screenshot 2026-04-06 153841.png>)


- Killswitch access, does not run since the domain returns success

![alt text](image.png)

- Once the inetsim/fakenet is turned off, it gets executed and starts creating files, creates threads for encryption and starts encrypting

![alt text](image-1.png)

![alt text](image-2.png)

- It also starts searching the network for further propagation

![alt text](image-3.png)
![alt text](image-7.png)

- Resources section contains 32 bit file indicating dropper behaviour

![alt text](image-4.png)

- Strings show the tasksche.exe and service name mentioned mssecvc2.0 used for encryption and propagation

![alt text](image-5.png)

![alt text](image-6.png)

- Creates file tasksche.exe in C:\Windows\ directory

![alt text](image-8.png)

![alt text](<Screenshot 2026-04-06 153239.png>)

We can confirm from the pestudio rsrc section that this has been dropped by wannacry exe.

![alt text](image-9.png)

This is used for persistence. It creates a random folder for wannacry staging area inside
ProgramData. After execution of malware on host computer it tries to spread itself on other
windows computers using SMB port 445. It starts encrypting all the files and after that it
displays the ransomware popup and message.

### Advance Static Analysis

Here, we can figure out after entry and kill switch check, it checks for arguments and if no argument calls function which executes ransomware with arguments.

![alt text](image-10.png)

![alt text](image-11.png)

Executing with argument "Path/to/wncry -m security"

This starts mssecsvc2.0 service.

![alt text](image-12.png)

The second function, to create service tasksche.exe and run with /i argument with which the task runs immediately after creation. It writes the resource 1831 to the tasksche.exe

![alt text](image-13.png)

![alt text](image-14.png)

![alt text](image-15.png)

So the 1831.bin, when analysed we can see it generates random string based on computer name, and if it gets /i as argument then creates a hidden directory and copies to itself and creates random service and launch hidden copy of itself.

Registry entry is done for further persistance 

![alt text](image-16.png)

Also 1831.bin contains unzip functionality, so after checking the resource section we find out 2058 XIA section which is a ZIP file

![alt text](image-17.png)

Password to zip is mentioned here

![alt text](image-18.png)

We can see that this zip contains the ransom note along with few more exe

![alt text](image-19.png)

![alt text](image-20.png)

b.bmp or b.wnry

![alt text](image-21.png)

![alt text](image-22.png)

We can also further get from 1831.bin the bitcoin addresses 

![alt text](image-23.png)

The c.wnry contains string mostly for tor installation.

![alt text](image-24.png)

More details can be found here as well : https://hybrid-analysis.com/sample/ed01ebfbc9eb5bbea545af4d01bf5f1071661840480439c6e5babe8e080e41aa/697a13a13e45a335850f0d96