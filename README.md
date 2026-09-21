# ระบบต้นทุนเครื่องแกง - Starter

## สิ่งที่มี
- HTML + CSS + JavaScript
- Firebase Firestore
- เพิ่ม/แก้ไข/ลบวัตถุดิบแบบ Realtime
- แสดง DL และ OH แบบ Realtime
- ปุ่มนำเข้าข้อมูลเริ่มต้นตามข้อมูลที่ให้มา

## ก่อนใช้งาน
1. สร้าง Firebase Project
2. เปิด Firestore Database
3. สร้าง Web App ใน Firebase
4. คัดลอก Firebase Config ไปใส่ใน `js/firebase-config.js`
5. เปิดเว็บผ่าน Local Server เช่น VS Code Live Server

## หมายเหตุ
เกลือผสมไอโอดีนถูกเก็บตามข้อมูลที่ให้มาเป็น 1 โหล ราคา 60 บาท จึงตั้ง `purchaseUnit = โหล` และ `costPerUnit = 60 บาท/โหล` ไว้ก่อน
ถ้าต้องการให้ 1 โหล = 12 ถุง/กระปุก ให้ปรับ cost ต่อหน่วยเป็น 5 บาท/หน่วยในภายหลัง

## Firestore Collections
- ingredients
- labor_rates
- overhead

ยังไม่ได้ทำสูตรการผลิต, Stock Card, FIFO, COGS และรายงาน เพื่อให้เริ่มระบบได้เร็วและอยู่ในกรอบเวลา 5 ชั่วโมง
