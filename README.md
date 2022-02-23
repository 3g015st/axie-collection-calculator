# Axie Collection Calculator

The problem is that I wanted to know the estimated amount of my axie collection every month. But I don't have the time to check every axie's floor price over the marketplace. So I decided to do some automation lol.

The application must send me a spreadsheet through Google Drive, every end of the month with this kind of format.

***Format:***

![enter image description here](https://i.ibb.co/fMkB8dz/image.png)

![enter image description here](https://i.ibb.co/44qZhhW/image.png)

The spreadsheet must be divided into two sheets. Axie ID must be a clickable link that directs to the Axie Marketplace that contains axies that are similar to the Axie ID that will be clicked.

***Journal***

https://calendar.google.com/calendar/u/2?cid=aGhxZ2YzcHRla21tZmYzcWlocmIwdGV1ZG9AZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ

***Requirements***

 - Must execute every 30 days using a cron job scheduler.
 - Must be serverless, I don't want to handle any servers just for this task.
 - Must also fire a notification every time an upload has been made to my Google Sheets.
 - Spreadsheet name format must be : AXIE_COLLECTION_CALCULATION_MONTH_YEAR

***Architecture***

![enter image description here](https://i.postimg.cc/0Nwdty8t/image.png)

***Spreadsheet Algo***

![enter image description here](https://i.postimg.cc/htd0v5hv/spreadsheet-algo.jpg)


## EventBridge Setup

https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-run-lambda-schedule.html



