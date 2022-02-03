# Axie Collection Calculator

The problem is that I wanted to know the estimated amount of my axie collection every month. But I don't have the time to check every axie's floor price over the marketplace. So I decided to do some automation lol.

The application must send me a spreadsheet through Google Drive, every end of the month with this kind of format.

***Format:***

![enter image description here](https://i.ibb.co/fMkB8dz/image.png)

![enter image description here](https://i.ibb.co/44qZhhW/image.png)

The spreadsheet must be divided into two sheets. Axie ID must be a clickable link that directs to the Axie Marketplace that contains axies that are similar to the Axie ID that will be clicked.

***Journal***

https://calendar.google.com/calendar/embed?src=hhqgf3ptekmmff3qihrb0teudo%40group.calendar.google.com&ctz=Asia%2FManila

***Requirements***

 - Must execute every end of the month using a cron job scheduler.
 - Must be serverless, I don't want to handle any servers just for this task.
 - Must also fire a notification every time an upload has been made to my Google Drive.
 - Spreadsheet name format must be : AXIE_COLLECTION_CALCULATION_MONTH_YEAR

***Architecture***

![enter image description here](https://i.ibb.co/MfFMHtn/Axie-Collection-Calculator-drawio-1.png%22%20alt=%22Axie-Collection-Calculator-drawio-1)
