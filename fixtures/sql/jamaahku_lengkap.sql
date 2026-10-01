-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: jamaahku
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `jamaahku`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `jamaahku` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `jamaahku`;

--
-- Temporary table structure for view `active_batch_room`
--

DROP TABLE IF EXISTS `active_batch_room`;
/*!50001 DROP VIEW IF EXISTS `active_batch_room`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `active_batch_room` AS SELECT
 1 AS `id_batch_room`,
  1 AS `batch_room_code`,
  1 AS `id_batch`,
  1 AS `firestore_room_id` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `active_jamaah_batchroom`
--

DROP TABLE IF EXISTS `active_jamaah_batchroom`;
/*!50001 DROP VIEW IF EXISTS `active_jamaah_batchroom`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `active_jamaah_batchroom` AS SELECT
 1 AS `id_jamaah`,
  1 AS `nama_jamaah`,
  1 AS `nomor_telepon`,
  1 AS `jamaah_created_at`,
  1 AS `jamaah_is_active`,
  1 AS `tanggal_kepulangan`,
  1 AS `nama_batch`,
  1 AS `id_batch_room`,
  1 AS `id_batch` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `batch`
--

DROP TABLE IF EXISTS `batch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `batch` (
  `id_batch` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code_batch` varchar(255) NOT NULL,
  `nama_batch` varchar(255) NOT NULL,
  `tanggal_keberangkatan` date NOT NULL,
  `tanggal_kepulangan` date NOT NULL,
  `nomor_keberangkatan` varchar(255) NOT NULL,
  `id_ta` bigint(20) unsigned NOT NULL,
  `status` varchar(255) NOT NULL,
  `nama_pic` varchar(255) DEFAULT NULL,
  `file_jadwal_kegiatan` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_batch`),
  KEY `batch_id_ta_foreign` (`id_ta`),
  CONSTRAINT `batch_id_ta_foreign` FOREIGN KEY (`id_ta`) REFERENCES `travel_agent` (`id_ta`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `batch`
--

LOCK TABLES `batch` WRITE;
/*!40000 ALTER TABLE `batch` DISABLE KEYS */;
INSERT INTO `batch` VALUES (11,'QC-PATCH-BATCH','QC Patch Batch','2026-09-28','2026-10-15','QC',14,'1','QC Patch',NULL,1,'2026-09-29 04:45:27','2026-09-29 04:45:27'),(12,'BATCH-RM-01','Batch Umrah Ramadhan 1448H','2026-11-01','2026-11-15','SAFF-RM-01',14,'Batch Incoming',NULL,NULL,1,'2026-09-29 08:54:11','2026-09-29 08:54:11');
/*!40000 ALTER TABLE `batch` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `batch_room`
--

DROP TABLE IF EXISTS `batch_room`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `batch_room` (
  `id_batch_room` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `batch_room_code` varchar(255) DEFAULT NULL,
  `firestore_room_id` varchar(255) DEFAULT NULL,
  `id_batch` bigint(20) unsigned NOT NULL,
  `nama_pic` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `approve` int(11) DEFAULT 0,
  `expired_at` varchar(255) DEFAULT NULL,
  `submission_date` timestamp NULL DEFAULT NULL,
  `is_active` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id_batch_room`),
  KEY `batch_room_id_batch_foreign` (`id_batch`),
  CONSTRAINT `batch_room_id_batch_foreign` FOREIGN KEY (`id_batch`) REFERENCES `batch` (`id_batch`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `batch_room`
--

LOCK TABLES `batch_room` WRITE;
/*!40000 ALTER TABLE `batch_room` DISABLE KEYS */;
INSERT INTO `batch_room` VALUES (1,'ROOM-B11-KLOTER1','room_makkah_batch_11',11,'Ustadz Ahmad Muthawif','2026-09-26 02:29:00','2026-10-01 02:29:00',1,NULL,'2026-09-26 02:29:00',1),(2,'ROOM-B12-KLOTER2','room_madinah_batch_12',12,'H. Ridwan Tour Leader','2026-09-28 02:29:00','2026-10-01 02:29:00',1,NULL,'2026-09-28 02:29:00',1);
/*!40000 ALTER TABLE `batch_room` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `batch_room_leader`
--

DROP TABLE IF EXISTS `batch_room_leader`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `batch_room_leader` (
  `id_batch_room_leader` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_batch_room` bigint(20) unsigned NOT NULL,
  `id_tl` bigint(20) unsigned NOT NULL,
  `is_mutawif` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_batch_room_leader`),
  KEY `batch_room_leader_id_batch_room_foreign` (`id_batch_room`),
  KEY `batch_room_leader_id_tl_foreign` (`id_tl`),
  CONSTRAINT `batch_room_leader_id_batch_room_foreign` FOREIGN KEY (`id_batch_room`) REFERENCES `batch_room` (`id_batch_room`),
  CONSTRAINT `batch_room_leader_id_tl_foreign` FOREIGN KEY (`id_tl`) REFERENCES `tour_leader` (`id_tl`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `batch_room_leader`
--

LOCK TABLES `batch_room_leader` WRITE;
/*!40000 ALTER TABLE `batch_room_leader` DISABLE KEYS */;
INSERT INTO `batch_room_leader` VALUES (1,1,8,1,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(2,1,9,1,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(3,1,10,1,1,'2026-10-01 02:29:00','2026-10-01 02:29:00');
/*!40000 ALTER TABLE `batch_room_leader` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `batch_room_list`
--

DROP TABLE IF EXISTS `batch_room_list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `batch_room_list` (
  `id_batch_room_list` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_batch_room` bigint(20) unsigned NOT NULL,
  `id_jamaah` bigint(20) unsigned NOT NULL,
  `is_mutawif` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_batch_room_list`),
  KEY `batch_room_list_id_batch_room_foreign` (`id_batch_room`),
  KEY `batch_room_list_id_jamaah_foreign` (`id_jamaah`),
  CONSTRAINT `batch_room_list_id_batch_room_foreign` FOREIGN KEY (`id_batch_room`) REFERENCES `batch_room` (`id_batch_room`),
  CONSTRAINT `batch_room_list_id_jamaah_foreign` FOREIGN KEY (`id_jamaah`) REFERENCES `jamaah` (`id_jamaah`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `batch_room_list`
--

LOCK TABLES `batch_room_list` WRITE;
/*!40000 ALTER TABLE `batch_room_list` DISABLE KEYS */;
INSERT INTO `batch_room_list` VALUES (1,1,13,0,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(2,1,14,0,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(3,1,15,0,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(4,1,16,0,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(5,1,17,0,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(6,1,18,0,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(7,1,19,0,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(8,1,20,0,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(9,1,21,0,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(10,1,22,0,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(11,1,23,0,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(12,1,24,0,1,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(13,1,13,0,0,NULL,NULL),(14,2,13,0,0,NULL,NULL),(15,1,13,0,0,NULL,NULL),(16,2,13,0,0,NULL,NULL);
/*!40000 ALTER TABLE `batch_room_list` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `broadcast_pesan`
--

DROP TABLE IF EXISTS `broadcast_pesan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `broadcast_pesan` (
  `id_broadcast` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `judul_pesan` text NOT NULL,
  `isi_pesan` text NOT NULL,
  `tanggal` date NOT NULL,
  `waktu` time NOT NULL,
  `id_pengirim_pesan` bigint(20) unsigned NOT NULL,
  `id_penerima_pesan` bigint(20) unsigned NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `is_read_admin` char(255) DEFAULT '0',
  PRIMARY KEY (`id_broadcast`),
  KEY `broadcast_pesan_id_pengirim_pesan_foreign` (`id_pengirim_pesan`),
  KEY `broadcast_pesan_id_penerima_pesan_foreign` (`id_penerima_pesan`),
  CONSTRAINT `broadcast_pesan_id_penerima_pesan_foreign` FOREIGN KEY (`id_penerima_pesan`) REFERENCES `users` (`id_user`),
  CONSTRAINT `broadcast_pesan_id_pengirim_pesan_foreign` FOREIGN KEY (`id_pengirim_pesan`) REFERENCES `users` (`id_user`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `broadcast_pesan`
--

LOCK TABLES `broadcast_pesan` WRITE;
/*!40000 ALTER TABLE `broadcast_pesan` DISABLE KEYS */;
INSERT INTO `broadcast_pesan` VALUES (1,'Pengingat Waktu Miqat & Tata Cara Berpakaian Ihram','Assalamu\'alaikum wr wb. Diberitahukan kepada seluruh jamaah Batch Umrah Ramadhan, bus akan berangkat dari Madinah menuju Makkah pukul 08:30 WAS. Pastikan seluruh jamaah sudah mandi sunnah ihram dan mengenakan pakaian ihram dari hotel.','2026-10-01','07:00:00',42,43,0,'2026-10-01 02:29:00','2026-10-01 02:29:00','0'),(2,'Titik Kumpul Sholat Ashar & Thawaf Sunnah Bersama','Rombongan akan berkumpul di Lobby Utama Pullman Zamzam Tower pukul 15:00 WAS untuk menuju Masjidil Haram bersama Muthawif Ustadz Ahmad. Mohon gunakan selalu Smartwatch SAFF di pergelangan tangan.','2026-10-01','13:30:00',42,43,0,'2026-09-30 20:29:00','2026-09-30 20:29:00','0'),(3,'Jadwal Ziarah Kota Madinah: Masjid Quba & Jabal Uhud','Agenda esok pagi adalah kunjungan ke Masjid Quba (wudhu dari hotel untuk pahala senilai umrah), dilanjutkan ke Makam Syuhada Jabal Uhud dan Kebun Kurma. Harap siap di lobi pukul 07:00 WAS.','2026-09-30','20:00:00',42,43,0,'2026-09-30 14:29:00','2026-09-30 14:29:00','0'),(4,'Pemeriksaan Kesehatan & Cek Baterai Smartwatch','Mohon lakukan pengisian daya smartwatch malam ini sebelum istirahat. Jika ada jamaah yang mengalami kelelahan atau flu, silakan hubungi tim medis travel di kamar 402.','2026-09-29','21:15:00',42,43,0,'2026-09-30 08:29:00','2026-09-30 08:29:00','0');
/*!40000 ALTER TABLE `broadcast_pesan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `chat_by_batch_room`
--

DROP TABLE IF EXISTS `chat_by_batch_room`;
/*!50001 DROP VIEW IF EXISTS `chat_by_batch_room`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `chat_by_batch_room` AS SELECT
 1 AS `id_room`,
  1 AS `id_batch`,
  1 AS `id_jamaah`,
  1 AS `id_tl`,
  1 AS `id_user`,
  1 AS `nama_user`,
  1 AS `photo`,
  1 AS `nomor_telepon`,
  1 AS `is_mutawif`,
  1 AS `is_tl`,
  1 AS `nama_batch`,
  1 AS `batch_room_code`,
  1 AS `tanggal_keberangkatan`,
  1 AS `tanggal_kepulangan`,
  1 AS `device_token`,
  1 AS `os`,
  1 AS `id_watch_jamaah` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `config_app`
--

DROP TABLE IF EXISTS `config_app`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `config_app` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_ta` bigint(20) unsigned NOT NULL,
  `interval_time_tracking` int(11) NOT NULL,
  `unique_code_batch` varchar(255) NOT NULL,
  `max_number_of_room` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `config_app_id_ta_foreign` (`id_ta`),
  CONSTRAINT `config_app_id_ta_foreign` FOREIGN KEY (`id_ta`) REFERENCES `travel_agent` (`id_ta`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `config_app`
--

LOCK TABLES `config_app` WRITE;
/*!40000 ALTER TABLE `config_app` DISABLE KEYS */;
INSERT INTO `config_app` VALUES (5,14,15,'SAFF-KLOTER-2026',100,'2026-10-01 02:34:48','2026-10-01 02:34:48');
/*!40000 ALTER TABLE `config_app` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `default_config_app`
--

DROP TABLE IF EXISTS `default_config_app`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `default_config_app` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `interval_time_tracking` int(11) NOT NULL DEFAULT 180,
  `unique_code_batch` varchar(255) NOT NULL DEFAULT 'MA#####',
  `max_number_of_room` int(11) NOT NULL DEFAULT 25,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `default_config_app`
--

LOCK TABLES `default_config_app` WRITE;
/*!40000 ALTER TABLE `default_config_app` DISABLE KEYS */;
INSERT INTO `default_config_app` VALUES (1,180,'MA#####',25,'2026-08-11 01:50:58','2026-08-11 01:50:58');
/*!40000 ALTER TABLE `default_config_app` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `detail_alamat`
--

DROP TABLE IF EXISTS `detail_alamat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `detail_alamat` (
  `id_detail_alamat` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_user` bigint(20) unsigned NOT NULL,
  `id_province` bigint(20) unsigned DEFAULT NULL,
  `alamat` varchar(255) DEFAULT NULL,
  `provinsi` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_detail_alamat`),
  KEY `detail_alamat_id_province_foreign` (`id_province`),
  KEY `detail_alamat_id_user_foreign` (`id_user`),
  CONSTRAINT `detail_alamat_id_province_foreign` FOREIGN KEY (`id_province`) REFERENCES `province` (`id_province`),
  CONSTRAINT `detail_alamat_id_user_foreign` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `detail_alamat`
--

LOCK TABLES `detail_alamat` WRITE;
/*!40000 ALTER TABLE `detail_alamat` DISABLE KEYS */;
INSERT INTO `detail_alamat` VALUES (2,46,NULL,'Jl. Riau No. 88, Bandung',NULL,'2026-09-29 08:58:50','2026-09-29 08:58:50');
/*!40000 ALTER TABLE `detail_alamat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `detail_group_chat_by_jamaah`
--

DROP TABLE IF EXISTS `detail_group_chat_by_jamaah`;
/*!50001 DROP VIEW IF EXISTS `detail_group_chat_by_jamaah`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `detail_group_chat_by_jamaah` AS SELECT
 1 AS `id_jamaah`,
  1 AS `id_user`,
  1 AS `nama_jamaah`,
  1 AS `id_room`,
  1 AS `batch_room_code`,
  1 AS `id_batch`,
  1 AS `nama_batch`,
  1 AS `tanggal_keberangkatan`,
  1 AS `tanggal_kepulangan`,
  1 AS `nama_travel_agent`,
  1 AS `nama_tour_leader`,
  1 AS `nama_mutawif` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `detail_group_chat_by_tl`
--

DROP TABLE IF EXISTS `detail_group_chat_by_tl`;
/*!50001 DROP VIEW IF EXISTS `detail_group_chat_by_tl`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `detail_group_chat_by_tl` AS SELECT
 1 AS `id_tl`,
  1 AS `id_user`,
  1 AS `id_room`,
  1 AS `batch_room_code`,
  1 AS `id_batch`,
  1 AS `nama_batch`,
  1 AS `tanggal_keberangkatan`,
  1 AS `tanggal_kepulangan`,
  1 AS `nama_travel_agent`,
  1 AS `nama_tour_leader`,
  1 AS `nama_mutawif` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `device_capabilities`
--

DROP TABLE IF EXISTS `device_capabilities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_capabilities` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) unsigned NOT NULL,
  `profile_id` bigint(20) unsigned DEFAULT NULL,
  `supports_location` tinyint(1) DEFAULT NULL,
  `supports_health` tinyint(1) DEFAULT NULL,
  `supports_manual_health` tinyint(1) DEFAULT NULL,
  `supports_periodic_health` tinyint(1) DEFAULT NULL,
  `supports_heart_rate` tinyint(1) DEFAULT NULL,
  `supports_blood_pressure` tinyint(1) DEFAULT NULL,
  `supports_blood_oxygen` tinyint(1) DEFAULT NULL,
  `supports_temperature` tinyint(1) DEFAULT NULL,
  `supports_steps` tinyint(1) DEFAULT NULL,
  `location_interval_seconds` int(10) unsigned DEFAULT NULL,
  `health_interval_seconds` int(10) unsigned DEFAULT NULL,
  `source` varchar(24) NOT NULL DEFAULT 'OBSERVED',
  `confidence` decimal(5,2) NOT NULL DEFAULT 0.00,
  `profile_match_metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`profile_match_metadata`)),
  `last_analyzed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_capabilities_device_id_unique` (`device_id`),
  KEY `device_capabilities_profile_id_foreign` (`profile_id`),
  KEY `device_capabilities_source_index` (`source`),
  KEY `device_capabilities_last_analyzed_at_index` (`last_analyzed_at`),
  CONSTRAINT `device_capabilities_device_id_foreign` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `device_capabilities_profile_id_foreign` FOREIGN KEY (`profile_id`) REFERENCES `device_profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_capabilities`
--

LOCK TABLES `device_capabilities` WRITE;
/*!40000 ALTER TABLE `device_capabilities` DISABLE KEYS */;
INSERT INTO `device_capabilities` VALUES (8,17,25,1,1,1,1,1,1,1,1,1,300,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(9,18,25,1,1,1,1,1,1,1,1,1,300,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(10,19,27,1,1,1,1,1,1,1,0,1,300,900,'PROFILE',95.00,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(11,20,26,1,0,0,0,0,0,0,0,0,120,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(12,21,25,1,1,1,1,1,1,1,1,1,300,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(13,22,28,1,0,0,0,0,0,0,0,1,600,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(14,23,27,1,1,1,1,1,1,1,0,1,300,900,'PROFILE',95.00,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(15,24,25,1,1,1,1,1,1,1,1,1,300,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(16,25,26,1,0,0,0,0,0,0,0,0,120,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(17,26,25,1,1,1,1,1,1,1,1,1,300,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(18,27,27,1,1,1,1,1,1,1,0,1,300,900,'PROFILE',95.00,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(19,28,25,1,1,1,1,1,1,1,1,1,300,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(20,29,28,1,0,0,0,0,0,0,0,1,600,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(21,30,26,1,0,0,0,0,0,0,0,0,120,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(22,31,25,1,1,1,1,1,1,1,1,1,300,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(23,32,27,1,1,1,1,1,1,1,0,1,300,900,'PROFILE',95.00,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(24,33,25,1,1,1,1,1,1,1,1,1,300,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(25,34,28,1,0,0,0,0,0,0,0,1,600,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(26,35,26,1,0,0,0,0,0,0,0,0,120,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(27,36,25,1,1,1,1,1,1,1,1,1,300,1800,'PROFILE',95.00,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15');
/*!40000 ALTER TABLE `device_capabilities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_configurations`
--

DROP TABLE IF EXISTS `device_configurations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_configurations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) unsigned NOT NULL,
  `profile_id` bigint(20) unsigned DEFAULT NULL,
  `desired_location_interval_seconds` int(10) unsigned DEFAULT NULL,
  `desired_health_interval_seconds` int(10) unsigned DEFAULT NULL,
  `observed_location_interval_seconds` int(10) unsigned DEFAULT NULL,
  `observed_health_interval_seconds` int(10) unsigned DEFAULT NULL,
  `auto_provision_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `configuration_status` varchar(24) NOT NULL DEFAULT 'UNCONFIGURED',
  `effective_configuration` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`effective_configuration`)),
  `last_applied_at` timestamp NULL DEFAULT NULL,
  `last_verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_configurations_device_id_unique` (`device_id`),
  KEY `device_configurations_profile_id_foreign` (`profile_id`),
  KEY `device_configurations_auto_provision_enabled_index` (`auto_provision_enabled`),
  KEY `device_configurations_configuration_status_index` (`configuration_status`),
  CONSTRAINT `device_configurations_device_id_foreign` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `device_configurations_profile_id_foreign` FOREIGN KEY (`profile_id`) REFERENCES `device_profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_configurations`
--

LOCK TABLES `device_configurations` WRITE;
/*!40000 ALTER TABLE `device_configurations` DISABLE KEYS */;
INSERT INTO `device_configurations` VALUES (7,17,25,300,1800,300,1800,1,'EFFECTIVE','{\"location_interval\":300,\"health_interval\":1800}','2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(8,18,25,300,1800,300,1800,1,'EFFECTIVE','{\"location_interval\":300,\"health_interval\":1800}','2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(9,19,27,300,900,300,900,1,'EFFECTIVE','{\"location_interval\":300,\"health_interval\":900}','2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(10,20,26,120,1800,120,1800,1,'EFFECTIVE','{\"location_interval\":120,\"health_interval\":1800}','2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(11,21,25,300,1800,300,1800,1,'EFFECTIVE','{\"location_interval\":300,\"health_interval\":1800}','2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(12,22,28,600,1800,600,1800,1,'EFFECTIVE','{\"location_interval\":600,\"health_interval\":1800}','2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(13,23,27,300,900,300,900,1,'EFFECTIVE','{\"location_interval\":300,\"health_interval\":900}','2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 01:21:15','2026-08-13 01:21:15'),(14,24,25,300,1800,300,1800,1,'EFFECTIVE','{\"location_interval\":300,\"health_interval\":1800}','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(15,25,26,120,1800,120,1800,1,'EFFECTIVE','{\"location_interval\":120,\"health_interval\":1800}','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(16,26,25,300,1800,300,1800,1,'EFFECTIVE','{\"location_interval\":300,\"health_interval\":1800}','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(17,27,27,300,900,300,900,1,'EFFECTIVE','{\"location_interval\":300,\"health_interval\":900}','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(18,28,25,300,1800,300,1800,1,'EFFECTIVE','{\"location_interval\":300,\"health_interval\":1800}','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(19,29,28,600,1800,600,1800,1,'EFFECTIVE','{\"location_interval\":600,\"health_interval\":1800}','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(20,30,26,120,1800,120,1800,1,'EFFECTIVE','{\"location_interval\":120,\"health_interval\":1800}','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(21,31,25,300,1800,300,1800,1,'EFFECTIVE','{\"location_interval\":300,\"health_interval\":1800}','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(22,32,27,300,900,300,900,1,'EFFECTIVE','{\"location_interval\":300,\"health_interval\":900}','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(23,33,25,300,1800,300,1800,1,'EFFECTIVE','{\"location_interval\":300,\"health_interval\":1800}','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(24,34,28,600,1800,600,1800,1,'EFFECTIVE','{\"location_interval\":600,\"health_interval\":1800}','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(25,35,26,120,1800,120,1800,1,'EFFECTIVE','{\"location_interval\":120,\"health_interval\":1800}','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(26,36,25,300,1800,300,1800,1,'EFFECTIVE','{\"location_interval\":300,\"health_interval\":1800}','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15');
/*!40000 ALTER TABLE `device_configurations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_errors`
--

DROP TABLE IF EXISTS `device_errors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_errors` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) unsigned NOT NULL,
  `error_code` varchar(100) NOT NULL,
  `severity` varchar(16) NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'OPEN',
  `message` varchar(500) NOT NULL,
  `technical_detail` text DEFAULT NULL,
  `first_occurred_at` timestamp NULL DEFAULT NULL,
  `last_occurred_at` timestamp NULL DEFAULT NULL,
  `occurrence_count` int(10) unsigned NOT NULL DEFAULT 1,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `resolved_by` bigint(20) unsigned DEFAULT NULL,
  `resolution` text DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `device_errors_resolved_by_foreign` (`resolved_by`),
  KEY `device_errors_device_id_status_severity_index` (`device_id`,`status`,`severity`),
  KEY `device_errors_device_id_error_code_status_index` (`device_id`,`error_code`,`status`),
  KEY `device_errors_error_code_index` (`error_code`),
  KEY `device_errors_severity_index` (`severity`),
  KEY `device_errors_status_index` (`status`),
  KEY `device_errors_last_occurred_at_index` (`last_occurred_at`),
  CONSTRAINT `device_errors_device_id_foreign` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `device_errors_resolved_by_foreign` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id_user`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_errors`
--

LOCK TABLES `device_errors` WRITE;
/*!40000 ALTER TABLE `device_errors` DISABLE KEYS */;
INSERT INTO `device_errors` VALUES (1,19,'ERR_LOW_BATTERY','WARNING','OPEN','Baterai perangkat (18%) berada di bawah ambang batas aman 20%.','Lakukan pengisian daya (charge) perangkat atau informasikan ke Jamaah.','2026-08-12 23:21:14','2026-08-13 01:21:14',5,NULL,NULL,NULL,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14'),(2,19,'ERR_HEART_RATE_HIGH','CRITICAL','OPEN','Detak jantung Jamaah terdeteksi tinggi (112 BPM).','Pantau kondisi Jamaah melalui petugas medis Tour Leader.','2026-08-13 00:51:14','2026-08-13 01:21:14',3,NULL,NULL,NULL,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14'),(3,22,'ERR_PROVISIONING_FAILED','WARNING','OPEN','Gagal mengirimkan perintah provisi interval GPS ke perangkat.','Perangkat tidak merespons balasan ACK SMS/GPRS.','2026-08-12 20:21:14','2026-08-13 01:21:14',2,NULL,NULL,NULL,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14'),(4,23,'ERR_LOW_BATTERY','WARNING','OPEN','Baterai perangkat (12%) berada di bawah ambang batas aman 20%.','Lakukan pengisian daya (charge) perangkat atau informasikan ke Jamaah.','2026-08-12 23:21:14','2026-08-13 01:21:14',5,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15'),(5,23,'ERR_HEART_RATE_HIGH','CRITICAL','OPEN','Detak jantung Jamaah terdeteksi tinggi (125 BPM).','Pantau kondisi Jamaah melalui petugas medis Tour Leader.','2026-08-13 00:51:14','2026-08-13 01:21:14',3,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15'),(6,23,'ERR_SOS_TRIGGERED','CRITICAL','OPEN','Tombol Darurat (SOS) ditekan pada Smartwatch!','Perangkat dimasukkan ke status Karantina/Investigasi Darurat.','2026-08-13 01:06:14','2026-08-13 01:21:14',1,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15');
/*!40000 ALTER TABLE `device_errors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_events`
--

DROP TABLE IF EXISTS `device_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) unsigned NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `source` varchar(24) NOT NULL,
  `severity` varchar(16) NOT NULL DEFAULT 'INFO',
  `message` varchar(500) NOT NULL,
  `actor_type` varchar(24) DEFAULT NULL,
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `occurred_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `device_events_device_id_event_type_occurred_at_index` (`device_id`,`event_type`,`occurred_at`),
  KEY `device_events_event_type_index` (`event_type`),
  KEY `device_events_source_index` (`source`),
  KEY `device_events_severity_index` (`severity`),
  KEY `device_events_occurred_at_index` (`occurred_at`),
  CONSTRAINT `device_events_device_id_foreign` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_events`
--

LOCK TABLES `device_events` WRITE;
/*!40000 ALTER TABLE `device_events` DISABLE KEYS */;
INSERT INTO `device_events` VALUES (4,17,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Smartwatch GPS Wonlex KT15 (Ahmad)',NULL,NULL,NULL,'2026-08-13 00:47:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(5,18,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Smartwatch GPS Wonlex GW400S (Budi)',NULL,NULL,NULL,'2026-08-13 00:31:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(6,19,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Smartwatch GPS Concox Q2 (Siti)',NULL,NULL,NULL,'2026-08-13 00:49:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(7,20,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Topin G03 Tracker (Koper 01)',NULL,NULL,NULL,'2026-08-13 00:22:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(8,21,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Smartwatch GPS Wonlex KT15 (Usman)',NULL,NULL,NULL,'2026-08-12 23:44:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(9,22,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari EV-07S Emergency Badge (Fatimah)',NULL,NULL,NULL,'2026-08-12 23:57:14','2026-08-13 01:21:14','2026-08-13 01:21:14'),(10,23,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Smartwatch GPS Concox Q2 (Hasan)',NULL,NULL,NULL,'2026-08-12 23:55:14','2026-08-13 01:21:15','2026-08-13 01:21:15'),(11,24,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Smartwatch GPS Wonlex KT15 (Zainab)',NULL,NULL,NULL,'2026-08-13 00:40:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(12,25,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Topin G03 Tracker (Koper 02)',NULL,NULL,NULL,'2026-08-13 00:59:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(13,26,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Smartwatch GPS Wonlex GW400S (Omar)',NULL,NULL,NULL,'2026-08-12 23:44:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(14,27,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Smartwatch GPS Concox Q2 (Khadijah)',NULL,NULL,NULL,'2026-08-12 23:57:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(15,28,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Smartwatch GPS Wonlex KT15 (Hamzah)',NULL,NULL,NULL,'2026-08-12 23:42:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(16,29,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari EV-07S Emergency Badge (Aisyah)',NULL,NULL,NULL,'2026-08-13 00:47:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(17,30,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Topin G03 Tracker (Bus 01)',NULL,NULL,NULL,'2026-08-12 23:43:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(18,31,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Smartwatch GPS Wonlex KT15 (Bilal)',NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(19,32,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Smartwatch GPS Concox Q2 (Sumayyah)',NULL,NULL,NULL,'2026-08-12 23:41:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(20,33,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Smartwatch GPS Wonlex GW400S (Ali)',NULL,NULL,NULL,'2026-08-12 23:45:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(21,34,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari EV-07S Emergency Badge (Tariq)',NULL,NULL,NULL,'2026-08-13 00:28:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(22,35,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Topin G03 Tracker (Koper 03)',NULL,NULL,NULL,'2026-08-13 00:27:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(23,36,'TELEMETRY_RECEIVED','TRACCAR','INFO','Paket data GPS & Telemetri diterima dari Smartwatch GPS Wonlex KT15 (Ruqayyah)',NULL,NULL,NULL,'2026-08-13 00:48:15','2026-08-13 01:21:15','2026-08-13 01:21:15'),(24,24,'QUARANTINED','ADMIN','WARNING','Device dikarantina oleh admin.','ADMIN',19,'{\"reason\":\"rusak\"}','2026-08-13 02:51:24','2026-08-13 02:51:24','2026-08-13 02:51:24'),(25,24,'UNQUARANTINED','ADMIN','INFO','Karantina device dibuka oleh admin. Safety guard lain tetap berlaku.','ADMIN',19,'{\"previous_reason\":\"rusak\"}','2026-08-13 02:54:41','2026-08-13 02:54:41','2026-08-13 02:54:41');
/*!40000 ALTER TABLE `device_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_gps`
--

DROP TABLE IF EXISTS `device_gps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_gps` (
  `id_gps` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nama_perangkat` varchar(255) NOT NULL,
  `id_perangkat` varchar(255) NOT NULL COMMENT 'IMEI PERANGKAT GPS',
  `id_koper` varchar(255) DEFAULT NULL,
  `deskripsi` text DEFAULT NULL,
  `id_ta` bigint(20) unsigned NOT NULL,
  `deviceId_traccar` bigint(20) unsigned NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_gps`),
  KEY `device_gps_id_ta_foreign` (`id_ta`),
  CONSTRAINT `device_gps_id_ta_foreign` FOREIGN KEY (`id_ta`) REFERENCES `travel_agent` (`id_ta`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_gps`
--

LOCK TABLES `device_gps` WRITE;
/*!40000 ALTER TABLE `device_gps` DISABLE KEYS */;
INSERT INTO `device_gps` VALUES (9,'GPS Koper QC Patch Jamaah','GPS-KOPER-001','KPR-SAFF-001','GPS Tracker Koper Bagasi Jamaah QC Patch Jamaah',14,7000,1,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(10,'GPS Koper Haji Sulaiman Al-Farisi','GPS-KOPER-002','KPR-SAFF-002','GPS Tracker Koper Bagasi Jamaah Haji Sulaiman Al-Farisi',14,7001,1,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(11,'GPS Koper H. Sulaiman Al-Farisi','GPS-KOPER-003','KPR-SAFF-003','GPS Tracker Koper Bagasi Jamaah H. Sulaiman Al-Farisi',14,7002,1,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(12,'GPS Koper Hj. Siti Aisyah Nurhaliza','GPS-KOPER-004','KPR-SAFF-004','GPS Tracker Koper Bagasi Jamaah Hj. Siti Aisyah Nurhaliza',14,7003,1,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(13,'GPS Koper H. Muhammad Ridwan','GPS-KOPER-005','KPR-SAFF-005','GPS Tracker Koper Bagasi Jamaah H. Muhammad Ridwan',14,7004,1,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(14,'GPS Koper Hj. Khadijah Binti Usman','GPS-KOPER-006','KPR-SAFF-006','GPS Tracker Koper Bagasi Jamaah Hj. Khadijah Binti Usman',14,7005,1,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(15,'GPS Koper H. Abdul Rasyid Pratama','GPS-KOPER-007','KPR-SAFF-007','GPS Tracker Koper Bagasi Jamaah H. Abdul Rasyid Pratama',14,7006,1,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(16,'GPS Koper Hj. Nurul Hidayati','GPS-KOPER-008','KPR-SAFF-008','GPS Tracker Koper Bagasi Jamaah Hj. Nurul Hidayati',14,7007,1,'2026-10-01 02:34:49','2026-10-01 02:34:49');
/*!40000 ALTER TABLE `device_gps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_observations`
--

DROP TABLE IF EXISTS `device_observations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_observations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) unsigned NOT NULL,
  `observation_type` varchar(64) NOT NULL,
  `packet_key` varchar(100) NOT NULL DEFAULT '*',
  `first_seen_at` timestamp NULL DEFAULT NULL,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `observation_count` bigint(20) unsigned NOT NULL DEFAULT 1,
  `minimum_interval_seconds` int(10) unsigned DEFAULT NULL,
  `average_interval_seconds` int(10) unsigned DEFAULT NULL,
  `last_interval_seconds` int(10) unsigned DEFAULT NULL,
  `sample` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`sample`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_observation_unique` (`device_id`,`observation_type`,`packet_key`),
  KEY `device_observations_device_id_last_seen_at_index` (`device_id`,`last_seen_at`),
  KEY `device_observations_observation_type_index` (`observation_type`),
  CONSTRAINT `device_observations_device_id_foreign` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_observations`
--

LOCK TABLES `device_observations` WRITE;
/*!40000 ALTER TABLE `device_observations` DISABLE KEYS */;
/*!40000 ALTER TABLE `device_observations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_positions`
--

DROP TABLE IF EXISTS `device_positions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_positions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) unsigned NOT NULL,
  `jamaah_id` bigint(20) unsigned DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `altitude` double DEFAULT NULL,
  `speed` double DEFAULT NULL,
  `course` double DEFAULT NULL,
  `battery_level` int(11) DEFAULT NULL,
  `steps` bigint(20) DEFAULT NULL,
  `heart_rate` int(11) DEFAULT NULL,
  `blood_oxygen` int(11) DEFAULT NULL,
  `blood_pressure_high` varchar(255) DEFAULT NULL,
  `blood_pressure_low` varchar(255) DEFAULT NULL,
  `temperature` decimal(5,2) DEFAULT NULL,
  `satellites` int(11) DEFAULT NULL,
  `rssi` int(11) DEFAULT NULL,
  `motion` tinyint(1) DEFAULT NULL,
  `alarm` varchar(255) DEFAULT NULL,
  `fix_time` timestamp NULL DEFAULT NULL,
  `device_time` timestamp NULL DEFAULT NULL,
  `server_time` timestamp NULL DEFAULT NULL,
  `attributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attributes`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `traccar_position_id` bigint(20) unsigned DEFAULT NULL,
  `ingest_hash` varchar(64) DEFAULT NULL,
  `valid` tinyint(1) DEFAULT NULL,
  `protocol` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_positions_device_id_ingest_hash_unique` (`device_id`,`ingest_hash`),
  KEY `device_positions_device_id_created_at_index` (`device_id`,`created_at`),
  KEY `device_positions_jamaah_id_created_at_index` (`jamaah_id`,`created_at`),
  KEY `device_positions_traccar_position_id_index` (`traccar_position_id`),
  CONSTRAINT `device_positions_device_id_foreign` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `device_positions_jamaah_id_foreign` FOREIGN KEY (`jamaah_id`) REFERENCES `jamaah` (`id_jamaah`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_positions`
--

LOCK TABLES `device_positions` WRITE;
/*!40000 ALTER TABLE `device_positions` DISABLE KEYS */;
INSERT INTO `device_positions` VALUES (5,17,NULL,21.4225000,39.8262000,15,5,222,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Masjidil Haram, Makkah\"}','2026-08-13 00:47:14','2026-08-13 01:21:14',NULL,NULL,NULL,NULL),(6,18,NULL,21.4230000,39.8268000,15,3,32,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Pelataran Tawaf, Makkah\"}','2026-08-13 00:31:14','2026-08-13 01:21:14',NULL,NULL,NULL,NULL),(7,19,NULL,21.4245000,39.8250000,15,1,329,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Area Sa\'i, Safa Marwah\"}','2026-08-13 00:49:14','2026-08-13 01:21:14',NULL,NULL,NULL,NULL),(8,20,NULL,21.4190000,39.8290000,15,2,290,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Hotel Abraj Al-Bait, Makkah\"}','2026-08-13 00:22:14','2026-08-13 01:21:14',NULL,NULL,NULL,NULL),(9,21,NULL,24.4672000,39.6112000,15,3,215,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Masjid Nabawi, Madinah\"}','2026-08-12 23:44:14','2026-08-13 01:21:14',NULL,NULL,NULL,NULL),(10,22,NULL,24.4680000,39.6120000,15,3,120,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Pelataran Masjid Nabawi, Madinah\"}','2026-08-12 23:57:14','2026-08-13 01:21:14',NULL,NULL,NULL,NULL),(11,23,NULL,21.4300000,39.8300000,15,3,31,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Area Mina, Makkah\"}','2026-08-12 23:55:14','2026-08-13 01:21:15',NULL,NULL,NULL,NULL),(12,24,NULL,24.4690000,39.6100000,15,1,186,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Pintu Raudhah, Masjid Nabawi\"}','2026-08-13 00:40:15','2026-08-13 01:21:15',NULL,NULL,NULL,NULL),(13,25,NULL,21.5433000,39.1728000,15,0,267,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Bandara King Abdulaziz, Jeddah\"}','2026-08-13 00:59:15','2026-08-13 01:21:15',NULL,NULL,NULL,NULL),(14,26,NULL,21.4220000,39.8260000,15,3,173,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Pelataran Masjidil Haram\"}','2026-08-12 23:44:15','2026-08-13 01:21:15',NULL,NULL,NULL,NULL),(15,27,NULL,21.4235000,39.8270000,15,0,214,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Area Jamarat, Mina\"}','2026-08-12 23:57:15','2026-08-13 01:21:15',NULL,NULL,NULL,NULL),(16,28,NULL,21.3548000,39.9841000,15,2,207,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Padang Arafah, Makkah\"}','2026-08-12 23:42:15','2026-08-13 01:21:15',NULL,NULL,NULL,NULL),(17,29,NULL,24.4670000,39.6105000,15,1,117,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Depan Hotel Oberoi, Madinah\"}','2026-08-13 00:47:15','2026-08-13 01:21:15',NULL,NULL,NULL,NULL),(18,30,NULL,21.5000000,39.5000000,15,2,278,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Jalan Tol Makkah - Madinah\"}','2026-08-12 23:43:15','2026-08-13 01:21:15',NULL,NULL,NULL,NULL),(19,32,NULL,21.4225000,39.8262000,15,0,87,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Makkah Almukarramah\"}','2026-08-12 23:41:15','2026-08-13 01:21:15',NULL,NULL,NULL,NULL),(20,33,NULL,21.4240000,39.8275000,15,0,258,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Jabal Nur, Makkah\"}','2026-08-12 23:45:15','2026-08-13 01:21:15',NULL,NULL,NULL,NULL),(21,34,NULL,24.4685000,39.6110000,15,2,187,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Jabal Uhud, Madinah\"}','2026-08-13 00:28:15','2026-08-13 01:21:15',NULL,NULL,NULL,NULL),(22,35,NULL,24.4675000,39.6125000,15,5,356,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Hotel PullMan Zamzam, Madinah\"}','2026-08-13 00:27:15','2026-08-13 01:21:15',NULL,NULL,NULL,NULL),(23,36,NULL,21.4232000,39.8265000,15,3,291,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'{\"address\":\"Pelataran Mataf, Makkah\"}','2026-08-13 00:48:15','2026-08-13 01:21:15',NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `device_positions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_profile_fingerprints`
--

DROP TABLE IF EXISTS `device_profile_fingerprints`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_profile_fingerprints` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `profile_id` bigint(20) unsigned NOT NULL,
  `model_pattern` varchar(255) DEFAULT NULL,
  `firmware_pattern` varchar(255) DEFAULT NULL,
  `protocol` varchar(64) DEFAULT NULL,
  `observed_behavior` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`observed_behavior`)),
  `priority` smallint(5) unsigned NOT NULL DEFAULT 100,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `device_profile_fingerprints_profile_id_priority_index` (`profile_id`,`priority`),
  KEY `device_profile_fingerprints_is_active_index` (`is_active`),
  CONSTRAINT `device_profile_fingerprints_profile_id_foreign` FOREIGN KEY (`profile_id`) REFERENCES `device_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_profile_fingerprints`
--

LOCK TABLES `device_profile_fingerprints` WRITE;
/*!40000 ALTER TABLE `device_profile_fingerprints` DISABLE KEYS */;
/*!40000 ALTER TABLE `device_profile_fingerprints` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_profiles`
--

DROP TABLE IF EXISTS `device_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_profiles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(100) NOT NULL,
  `name` varchar(150) NOT NULL,
  `vendor` varchar(100) DEFAULT NULL,
  `model` varchar(100) DEFAULT NULL,
  `firmware_pattern` varchar(255) DEFAULT NULL,
  `protocol` varchar(64) DEFAULT NULL,
  `verification_status` varchar(20) NOT NULL DEFAULT 'DRAFT',
  `capabilities` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`capabilities`)),
  `default_configuration` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`default_configuration`)),
  `command_configuration` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`command_configuration`)),
  `auto_provision_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `verified_at` timestamp NULL DEFAULT NULL,
  `verified_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_profiles_code_unique` (`code`),
  KEY `device_profiles_verified_by_foreign` (`verified_by`),
  KEY `device_profiles_vendor_index` (`vendor`),
  KEY `device_profiles_model_index` (`model`),
  KEY `device_profiles_protocol_index` (`protocol`),
  KEY `device_profiles_verification_status_index` (`verification_status`),
  KEY `device_profiles_auto_provision_enabled_index` (`auto_provision_enabled`),
  CONSTRAINT `device_profiles_verified_by_foreign` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id_user`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_profiles`
--

LOCK TABLES `device_profiles` WRITE;
/*!40000 ALTER TABLE `device_profiles` DISABLE KEYS */;
INSERT INTO `device_profiles` VALUES (25,'PROF-WONLEX-GW400S','Wonlex GW400S / KT15 Profile','Wonlex','GW400S',NULL,'hqt','VERIFIED','{\"supports_location\":true,\"supports_health\":true,\"supports_manual_health\":true,\"supports_periodic_health\":true,\"supports_heart_rate\":true,\"supports_blood_pressure\":true,\"supports_blood_oxygen\":true,\"supports_temperature\":true,\"supports_steps\":true,\"location_interval_seconds\":300,\"health_interval_seconds\":1800}','{\"location_interval\":300,\"health_interval\":1800}',NULL,1,NULL,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14'),(26,'PROF-TOPIN-G03','Topin G03 GPS Tracker Profile','Topin','G03',NULL,'gt06','VERIFIED','{\"supports_location\":true,\"supports_health\":false,\"supports_manual_health\":false,\"supports_periodic_health\":false,\"supports_heart_rate\":false,\"supports_blood_pressure\":false,\"supports_blood_oxygen\":false,\"supports_temperature\":false,\"supports_steps\":false,\"location_interval_seconds\":120,\"health_interval_seconds\":null}','{\"location_interval\":120}',NULL,1,NULL,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14'),(27,'PROF-CONCOX-Q2','Concox Q2 Medical Smartwatch','Concox','Q2',NULL,'gt06','VERIFIED','{\"supports_location\":true,\"supports_health\":true,\"supports_manual_health\":true,\"supports_periodic_health\":true,\"supports_heart_rate\":true,\"supports_blood_pressure\":true,\"supports_blood_oxygen\":true,\"supports_temperature\":false,\"supports_steps\":true,\"location_interval_seconds\":300,\"health_interval_seconds\":900}','{\"location_interval\":300,\"health_interval\":900}',NULL,1,NULL,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14'),(28,'PROF-EWAY-EV07S','EV-07S Emergency Badge','Eway','EV-07S',NULL,'v33','VERIFIED','{\"supports_location\":true,\"supports_health\":false,\"supports_manual_health\":false,\"supports_periodic_health\":false,\"supports_heart_rate\":false,\"supports_blood_pressure\":false,\"supports_blood_oxygen\":false,\"supports_temperature\":false,\"supports_steps\":true,\"location_interval_seconds\":600,\"health_interval_seconds\":null}','{\"location_interval\":600}',NULL,1,NULL,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14');
/*!40000 ALTER TABLE `device_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_provisioning_runs`
--

DROP TABLE IF EXISTS `device_provisioning_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_provisioning_runs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) unsigned NOT NULL,
  `profile_id` bigint(20) unsigned DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'PENDING',
  `attempt` smallint(5) unsigned NOT NULL DEFAULT 1,
  `max_attempts` smallint(5) unsigned NOT NULL DEFAULT 2,
  `command_category` varchar(100) DEFAULT NULL,
  `command_payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`command_payload`)),
  `ack_expected` tinyint(1) NOT NULL DEFAULT 0,
  `started_at` timestamp NULL DEFAULT NULL,
  `command_sent_at` timestamp NULL DEFAULT NULL,
  `ack_received_at` timestamp NULL DEFAULT NULL,
  `verification_started_at` timestamp NULL DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `failed_at` timestamp NULL DEFAULT NULL,
  `error_code` varchar(100) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `device_provisioning_runs_profile_id_foreign` (`profile_id`),
  KEY `device_provisioning_runs_device_id_created_at_index` (`device_id`,`created_at`),
  KEY `device_provisioning_runs_status_index` (`status`),
  KEY `device_provisioning_runs_error_code_index` (`error_code`),
  CONSTRAINT `device_provisioning_runs_device_id_foreign` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `device_provisioning_runs_profile_id_foreign` FOREIGN KEY (`profile_id`) REFERENCES `device_profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_provisioning_runs`
--

LOCK TABLES `device_provisioning_runs` WRITE;
/*!40000 ALTER TABLE `device_provisioning_runs` DISABLE KEYS */;
/*!40000 ALTER TABLE `device_provisioning_runs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_states`
--

DROP TABLE IF EXISTS `device_states`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_states` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) unsigned NOT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `altitude` double DEFAULT NULL,
  `speed` double DEFAULT NULL,
  `course` double DEFAULT NULL,
  `battery_level` int(11) DEFAULT NULL,
  `steps` bigint(20) DEFAULT NULL,
  `heart_rate` int(11) DEFAULT NULL,
  `blood_oxygen` int(11) DEFAULT NULL,
  `blood_pressure_high` varchar(255) DEFAULT NULL,
  `blood_pressure_low` varchar(255) DEFAULT NULL,
  `temperature` decimal(5,2) DEFAULT NULL,
  `satellites` int(11) DEFAULT NULL,
  `rssi` int(11) DEFAULT NULL,
  `motion` tinyint(1) DEFAULT NULL,
  `alarm` varchar(255) DEFAULT NULL,
  `fix_time` timestamp NULL DEFAULT NULL,
  `device_time` timestamp NULL DEFAULT NULL,
  `server_time` timestamp NULL DEFAULT NULL,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `raw_attributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_attributes`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `last_packet_at` timestamp NULL DEFAULT NULL,
  `last_location_at` timestamp NULL DEFAULT NULL,
  `last_health_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_states_device_id_unique` (`device_id`),
  KEY `device_states_last_packet_at_index` (`last_packet_at`),
  KEY `device_states_last_location_at_index` (`last_location_at`),
  KEY `device_states_last_health_at_index` (`last_health_at`),
  CONSTRAINT `device_states_device_id_foreign` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_states`
--

LOCK TABLES `device_states` WRITE;
/*!40000 ALTER TABLE `device_states` DISABLE KEYS */;
INSERT INTO `device_states` VALUES (5,17,21.4225000,39.8262000,NULL,NULL,NULL,95,4520,78,98,'120','80',36.60,15,22,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 00:47:14','2026-08-13 00:47:14','2026-08-13 00:47:14'),(6,18,21.4230000,39.8268000,NULL,NULL,NULL,82,6120,84,97,'125','82',36.80,14,26,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 00:31:14','2026-08-13 00:31:14','2026-08-13 00:31:14'),(7,19,21.4245000,39.8250000,NULL,NULL,NULL,18,8900,112,94,'140','90',37.10,14,19,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 00:49:14','2026-08-13 00:49:14','2026-08-13 00:49:14'),(8,20,21.4190000,39.8290000,NULL,NULL,NULL,74,NULL,NULL,NULL,NULL,NULL,NULL,8,29,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-13 00:22:14','2026-08-13 00:22:14',NULL),(9,21,24.4672000,39.6112000,NULL,NULL,NULL,88,3400,76,99,'118','78',36.50,15,15,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-12 23:44:14','2026-08-12 23:44:14','2026-08-12 23:44:14'),(10,22,24.4680000,39.6120000,NULL,NULL,NULL,45,1200,NULL,NULL,NULL,NULL,NULL,16,27,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:14','2026-08-13 01:21:14','2026-08-12 23:57:14','2026-08-12 23:57:14',NULL),(11,23,21.4300000,39.8300000,NULL,NULL,NULL,12,9500,125,93,'145','95',37.50,16,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-12 23:55:14','2026-08-12 23:55:14','2026-08-12 23:55:14'),(12,24,24.4690000,39.6100000,NULL,NULL,NULL,91,5200,72,99,'115','75',36.40,16,17,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 00:40:15','2026-08-13 00:40:15','2026-08-13 00:40:15'),(13,25,21.5433000,39.1728000,NULL,NULL,NULL,60,NULL,NULL,NULL,NULL,NULL,NULL,8,21,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 00:59:15','2026-08-13 00:59:15',NULL),(14,26,21.4220000,39.8260000,NULL,NULL,NULL,35,4100,80,97,'120','80',36.70,16,23,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-12 23:44:15','2026-08-12 23:44:15','2026-08-12 23:44:15'),(15,27,21.4235000,39.8270000,NULL,NULL,NULL,90,7300,75,98,'118','76',36.50,10,30,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-12 23:57:15','2026-08-12 23:57:15','2026-08-12 23:57:15'),(16,28,21.3548000,39.9841000,NULL,NULL,NULL,77,5800,82,96,'122','81',36.90,13,31,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-12 23:42:15','2026-08-12 23:42:15','2026-08-12 23:42:15'),(17,29,24.4670000,39.6105000,NULL,NULL,NULL,85,3100,NULL,NULL,NULL,NULL,NULL,16,15,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 00:47:15','2026-08-13 00:47:15',NULL),(18,30,21.5000000,39.5000000,NULL,NULL,NULL,100,NULL,NULL,NULL,NULL,NULL,NULL,10,16,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-12 23:43:15','2026-08-12 23:43:15',NULL),(19,32,21.4225000,39.8262000,NULL,NULL,NULL,50,1500,NULL,NULL,NULL,NULL,NULL,12,20,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-12 23:41:15','2026-08-12 23:41:15',NULL),(20,33,21.4240000,39.8275000,NULL,NULL,NULL,68,8400,79,97,'121','79',36.60,13,25,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-12 23:45:15','2026-08-12 23:45:15','2026-08-12 23:45:15'),(21,34,24.4685000,39.6110000,NULL,NULL,NULL,93,2900,NULL,NULL,NULL,NULL,NULL,9,21,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 00:28:15','2026-08-13 00:28:15',NULL),(22,35,24.4675000,39.6125000,NULL,NULL,NULL,89,NULL,NULL,NULL,NULL,NULL,NULL,14,23,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 00:27:15','2026-08-13 00:27:15',NULL),(23,36,21.4232000,39.8265000,NULL,NULL,NULL,97,5400,73,99,'117','77',36.50,11,23,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','2026-08-13 00:48:15','2026-08-13 00:48:15','2026-08-13 00:48:15');
/*!40000 ALTER TABLE `device_states` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_token`
--

DROP TABLE IF EXISTS `device_token`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_token` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `device_token` text NOT NULL,
  `id_user` bigint(20) unsigned NOT NULL,
  `id_role` bigint(20) unsigned NOT NULL,
  `os` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `device_token_id_user_foreign` (`id_user`),
  KEY `device_token_id_role_foreign` (`id_role`),
  CONSTRAINT `device_token_id_role_foreign` FOREIGN KEY (`id_role`) REFERENCES `roles` (`id_role`),
  CONSTRAINT `device_token_id_user_foreign` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_token`
--

LOCK TABLES `device_token` WRITE;
/*!40000 ALTER TABLE `device_token` DISABLE KEYS */;
INSERT INTO `device_token` VALUES (8,'e7pK28YBSVCrD-CD2M84Mt:APA91bFUTmgUX0MzC7uxGYeD66N-9-JSFh9tqMYN1OUTtdBReyl8ixnMDIRMibmqQvD7Ut16hvY-gt0MFqvcK1X8YJ2AlVA4kmlKbry3KCftqjell1T5138',40,4,'android','2026-09-29 04:08:47','2026-09-29 04:08:47');
/*!40000 ALTER TABLE `device_token` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `device_watch`
--

DROP TABLE IF EXISTS `device_watch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `device_watch` (
  `id_watch` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `imei` varchar(255) NOT NULL,
  `device_name` varchar(255) DEFAULT NULL,
  `deviceId_traccar` int(11) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `id_ta` bigint(20) unsigned NOT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `updated_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_watch`),
  KEY `device_watch_id_ta_foreign` (`id_ta`),
  CONSTRAINT `device_watch_id_ta_foreign` FOREIGN KEY (`id_ta`) REFERENCES `travel_agent` (`id_ta`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `device_watch`
--

LOCK TABLES `device_watch` WRITE;
/*!40000 ALTER TABLE `device_watch` DISABLE KEYS */;
INSERT INTO `device_watch` VALUES (21,'86420105000001','Smartwatch Wonlex 1',5000,1,14,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(22,'86420105000002','Smartwatch Wonlex 2',5001,1,14,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(23,'86420105000003','Smartwatch Wonlex 3',5002,1,14,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(24,'86420105000004','Smartwatch Wonlex 4',5003,1,14,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(25,'86420105000005','Smartwatch Wonlex 5',5004,1,14,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(26,'86420105000006','Smartwatch Wonlex 6',5005,1,14,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(27,'86420105000007','Smartwatch Wonlex 7',5006,1,14,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(28,'86420105000008','Smartwatch Wonlex 8',5007,1,14,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(29,'86420105000009','Smartwatch Wonlex 9',5008,1,14,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(30,'86420105000010','Smartwatch Wonlex 10',5009,1,14,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48');
/*!40000 ALTER TABLE `device_watch` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `devices`
--

DROP TABLE IF EXISTS `devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `devices` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `unique_id` varchar(255) NOT NULL,
  `imei` varchar(255) DEFAULT NULL,
  `traccar_device_id` bigint(20) unsigned DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `model` varchar(255) DEFAULT NULL,
  `firmware` varchar(255) DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'offline',
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `operational_status` varchar(32) NOT NULL DEFAULT 'REGISTERED',
  `connectivity_status` varchar(32) NOT NULL DEFAULT 'NEVER_CONNECTED',
  `protocol` varchar(64) DEFAULT NULL,
  `traccar_sync_status` varchar(32) NOT NULL DEFAULT 'PENDING',
  `traccar_sync_error` text DEFAULT NULL,
  `traccar_synced_at` timestamp NULL DEFAULT NULL,
  `first_connected_at` timestamp NULL DEFAULT NULL,
  `last_connected_at` timestamp NULL DEFAULT NULL,
  `last_disconnected_at` timestamp NULL DEFAULT NULL,
  `reconnect_count` int(10) unsigned NOT NULL DEFAULT 0,
  `quarantined_at` timestamp NULL DEFAULT NULL,
  `quarantine_reason` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `devices_unique_id_unique` (`unique_id`),
  KEY `devices_traccar_device_id_index` (`traccar_device_id`),
  KEY `devices_operational_status_index` (`operational_status`),
  KEY `devices_connectivity_status_index` (`connectivity_status`),
  KEY `devices_protocol_index` (`protocol`),
  KEY `devices_traccar_sync_status_index` (`traccar_sync_status`),
  KEY `devices_quarantined_at_index` (`quarantined_at`)
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `devices`
--

LOCK TABLES `devices` WRITE;
/*!40000 ALTER TABLE `devices` DISABLE KEYS */;
INSERT INTO `devices` VALUES (17,'JAMAAHKU-SW-001','867530901234501',100,'Smartwatch GPS Wonlex KT15 (Ahmad)','KT15','v2.4.12','online','2026-10-01 02:29:00','2026-08-13 01:21:14','2026-10-01 02:29:00','ACTIVE','CONNECTED','hqt','SYNCED',NULL,'2026-08-13 01:21:14','2026-08-08 00:47:14','2026-10-01 02:29:00',NULL,0,NULL,NULL),(18,'JAMAAHKU-SW-002','867530901234502',101,'Smartwatch GPS Wonlex GW400S (Budi)','GW400S','v2.4.10','online','2026-10-01 02:26:00','2026-08-13 01:21:14','2026-10-01 02:29:00','ACTIVE','CONNECTED','hqt','SYNCED',NULL,'2026-08-13 01:21:14','2026-08-08 00:31:14','2026-10-01 02:26:00',NULL,0,NULL,NULL),(19,'JAMAAHKU-SW-003','867530901234503',102,'Smartwatch GPS Concox Q2 (Siti)','Q2','v1.8.0','online','2026-10-01 02:23:00','2026-08-13 01:21:14','2026-10-01 02:29:00','ACTIVE','CONNECTED','gt06','SYNCED',NULL,'2026-08-13 01:21:14','2026-08-08 00:49:14','2026-10-01 02:23:00',NULL,0,NULL,NULL),(20,'JAMAAHKU-SW-004','867530901234504',103,'Topin G03 Tracker (Koper 01)','G03','v1.1.2','online','2026-10-01 02:20:00','2026-08-13 01:21:14','2026-10-01 02:29:00','ACTIVE','CONNECTED','gt06','SYNCED',NULL,'2026-08-13 01:21:14','2026-08-08 00:22:14','2026-10-01 02:20:00',NULL,0,NULL,NULL),(21,'JAMAAHKU-SW-005','867530901234505',104,'Smartwatch GPS Wonlex KT15 (Usman)','KT15','v2.4.12','online','2026-10-01 02:17:00','2026-08-13 01:21:14','2026-10-01 02:29:00','ACTIVE','CONNECTED','hqt','SYNCED',NULL,'2026-08-13 01:21:14','2026-08-07 23:44:14','2026-10-01 02:17:00',NULL,0,NULL,NULL),(22,'JAMAAHKU-SW-006','867530901234506',105,'EV-07S Emergency Badge (Fatimah)','EV-07S','v3.0.1','online','2026-10-01 02:14:00','2026-08-13 01:21:14','2026-10-01 02:29:00','ACTIVE','CONNECTED','v33','FAILED',NULL,NULL,'2026-08-07 23:57:14','2026-10-01 02:14:00',NULL,0,NULL,NULL),(23,'JAMAAHKU-SW-007','867530901234507',106,'Smartwatch GPS Concox Q2 (Hasan)','Q2','v1.8.0','online','2026-10-01 02:11:00','2026-08-13 01:21:14','2026-10-01 02:29:00','ACTIVE','CONNECTED','gt06','SYNCED',NULL,'2026-08-13 01:21:14','2026-08-07 23:55:14','2026-10-01 02:11:00',NULL,0,NULL,NULL),(24,'JAMAAHKU-SW-008','867530901234508',107,'Smartwatch GPS Wonlex KT15 (Zainab)','KT15','v2.4.12','online','2026-10-01 02:08:00','2026-08-13 01:21:15','2026-10-01 02:29:00','ACTIVE','CONNECTED','hqt','SYNCED',NULL,'2026-08-13 01:21:15','2026-08-08 00:40:15','2026-10-01 02:08:00',NULL,0,NULL,NULL),(25,'JAMAAHKU-SW-009','867530901234509',108,'Topin G03 Tracker (Koper 02)','G03','v1.1.2','online','2026-10-01 02:05:00','2026-08-13 01:21:15','2026-10-01 02:29:00','ACTIVE','CONNECTED','gt06','SYNCED',NULL,'2026-08-13 01:21:15','2026-08-08 00:59:15','2026-10-01 02:05:00',NULL,0,NULL,NULL),(26,'JAMAAHKU-SW-010','867530901234510',109,'Smartwatch GPS Wonlex GW400S (Omar)','GW400S','v2.4.10','online','2026-10-01 02:02:00','2026-08-13 01:21:15','2026-10-01 02:29:00','ACTIVE','CONNECTED','hqt','SYNCED',NULL,'2026-08-13 01:21:15','2026-08-07 23:44:15','2026-10-01 02:02:00',NULL,0,NULL,NULL),(27,'JAMAAHKU-SW-011','867530901234511',110,'Smartwatch GPS Concox Q2 (Khadijah)','Q2','v1.8.0','online','2026-10-01 01:59:00','2026-08-13 01:21:15','2026-10-01 02:29:00','ACTIVE','CONNECTED','gt06','SYNCED',NULL,'2026-08-13 01:21:15','2026-08-07 23:57:15','2026-10-01 01:59:00',NULL,0,NULL,NULL),(28,'JAMAAHKU-SW-012','867530901234512',111,'Smartwatch GPS Wonlex KT15 (Hamzah)','KT15','v2.4.12','online','2026-10-01 01:56:00','2026-08-13 01:21:15','2026-10-01 02:29:00','ACTIVE','CONNECTED','hqt','SYNCED',NULL,'2026-08-13 01:21:15','2026-08-07 23:42:15','2026-10-01 01:56:00',NULL,0,NULL,NULL),(29,'JAMAAHKU-SW-013','867530901234513',112,'EV-07S Emergency Badge (Aisyah)','EV-07S','v3.0.1','online','2026-08-13 00:47:15','2026-08-13 01:21:15','2026-08-13 01:21:15','ACTIVE','ONLINE','v33','SYNCED',NULL,'2026-08-13 01:21:15','2026-08-08 00:47:15','2026-08-13 00:47:15',NULL,0,NULL,NULL),(30,'JAMAAHKU-SW-014','867530901234514',113,'Topin G03 Tracker (Bus 01)','G03','v1.1.2','online','2026-08-12 23:43:15','2026-08-13 01:21:15','2026-08-13 01:21:15','ACTIVE','ONLINE','gt06','SYNCED',NULL,'2026-08-13 01:21:15','2026-08-07 23:43:15','2026-08-12 23:43:15',NULL,0,NULL,NULL),(31,'JAMAAHKU-SW-015','867530901234515',114,'Smartwatch GPS Wonlex KT15 (Bilal)','KT15','v2.4.12','offline',NULL,'2026-08-13 01:21:15','2026-08-13 01:21:15','REGISTERED','NEVER_CONNECTED','hqt','PENDING',NULL,NULL,NULL,NULL,NULL,0,NULL,NULL),(32,'JAMAAHKU-SW-016','867530901234516',115,'Smartwatch GPS Concox Q2 (Sumayyah)','Q2','v1.8.0','offline','2026-08-12 23:41:15','2026-08-13 01:21:15','2026-08-13 01:21:15','UNSUPPORTED','DISCONNECTED','gt06','SYNCED',NULL,'2026-08-13 01:21:15','2026-08-07 23:41:15','2026-08-12 23:41:15',NULL,0,NULL,NULL),(33,'JAMAAHKU-SW-017','867530901234517',116,'Smartwatch GPS Wonlex GW400S (Ali)','GW400S','v2.4.10','online','2026-08-12 23:45:15','2026-08-13 01:21:15','2026-08-13 01:21:15','ACTIVE','ONLINE','hqt','SYNCED',NULL,'2026-08-13 01:21:15','2026-08-07 23:45:15','2026-08-12 23:45:15',NULL,0,NULL,NULL),(34,'JAMAAHKU-SW-018','867530901234518',117,'EV-07S Emergency Badge (Tariq)','EV-07S','v3.0.1','online','2026-08-13 00:28:15','2026-08-13 01:21:15','2026-08-13 01:21:15','ACTIVE','ONLINE','v33','SYNCED',NULL,'2026-08-13 01:21:15','2026-08-08 00:28:15','2026-08-13 00:28:15',NULL,0,NULL,NULL),(35,'JAMAAHKU-SW-019','867530901234519',118,'Topin G03 Tracker (Koper 03)','G03','v1.1.2','online','2026-08-13 00:27:15','2026-08-13 01:21:15','2026-08-13 01:21:15','ACTIVE','ONLINE','gt06','SYNCED',NULL,'2026-08-13 01:21:15','2026-08-08 00:27:15','2026-08-13 00:27:15',NULL,0,NULL,NULL),(36,'JAMAAHKU-SW-020','867530901234520',119,'Smartwatch GPS Wonlex KT15 (Ruqayyah)','KT15','v2.4.12','online','2026-08-13 00:48:15','2026-08-13 01:21:15','2026-08-13 01:21:15','ACTIVE','ONLINE','hqt','SYNCED',NULL,'2026-08-13 01:21:15','2026-08-08 00:48:15','2026-08-13 00:48:15',NULL,0,NULL,NULL);
/*!40000 ALTER TABLE `devices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doa`
--

DROP TABLE IF EXISTS `doa`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `doa` (
  `id_doa` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_ta` bigint(20) unsigned DEFAULT NULL,
  `nama_doa` varchar(255) NOT NULL,
  `text_latin` text NOT NULL,
  `text_arab` text NOT NULL,
  `text_indonesia` text NOT NULL,
  `path_audio` text DEFAULT NULL,
  `path_subtitle_vtt` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_public` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_doa`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doa`
--

LOCK TABLES `doa` WRITE;
/*!40000 ALTER TABLE `doa` DISABLE KEYS */;
INSERT INTO `doa` VALUES (1,NULL,'Doa Keluar Rumah','Bismillahi tawakkaltu \'alallah, laa hawla wa laa quwwata illa billah','بِسْمِ اللّٰهِ تَوَكَّلْتُ عَلَى اللّٰهِ لَاحَوْلَ وَلَا قُوَّةَ الَّا بِاللّٰه','Dengan nama Allah aku bertawakal kepada Allah tiada daya untuk memperoleh manfaat dan tiada pula kuasa untuk menolak mudarat melainkan dengan pertolongan Allah. (HR Abu Daud dan Tirmizi)',NULL,NULL,1,1,1,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(2,NULL,'Doa Setelah Duduk dalam Kendaraan','Bismillahil malikirrahman. Wa mā qadarullāha ḥaqqa qadrihī wal-arḍu jamī\'ang qabḍatuhụ yaumal-qiyāmati was-samāwātu maṭwiyyātum biyamīnih, sub-ḥānahụ wa ta\'ālā \'ammā yusyrikụn. Bismillahi majreha wa mursaha inna rabbi la ghofurur rohim.','بِسْمِ اللّٰهِ الْمَالِكِ الرَّحْمٰنِ. وَمَا قَدَرُوا اللّٰهَ حَقَّ قَدْرِهِ وَالْأَرْضُ جَمِيعًا قَبْضَتُهُ يَوْمَ الْقِيَامَةِ وَالسَّمٰوَاتُ مَطْوِيّٰتٌ بِيَمِيْنِهِ سُبْحَانَهُ وَتَعَالَي عَمَّا يُشْرِكُوْنَ . بِسْمِ اللّٰهِ مَجْرٰيهَا وَمُرْسٰهَا إِنَّ رَبِّي لَغَفُورٌ رَّحِيمٌ','Dengan nama Allah Yang Maha Penguasa lagi Maha Pengasih. Tiada mengagungkan Allah sebagaimana mestinya, padahal bumi seluruhnya dalam genggaman-Nya pada hari kiamat dan langit digulung dengan kekuasaan-Nya. Maha Suci dan Maha Tinggi Dia dari apa yang mereka persekutukan. Dengan Nama Allah di waktu berangkat dan berlabuh. Sesungguhnya Tuhanku benar-benar Maha Pengampun lagi Maha Penyayang.',NULL,NULL,1,1,2,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(3,NULL,'Doa ketika Kendaraan Mulai Bergerak','Allahu Akbar, Allahu Akbar, Allahu Akbar. Subhanalladzi sakkhoro lana hadza wa maa kunnaa lahu muqrinin, wa innaa ilaa robbinaa lamunqolibun, allahumma inna nas\'aluka fii safarinaa hadzal birro wat taqwa wa minal \'amal maa tardho, allahumma hawwin \'alaina safarona hadza wa athwi \'annaa bu\'dahu, allahumma antas shohibu fis safari wal kholifatu fil ahli, allahumma inni a\'udzubika min wa\'tsaais safari wa kaabatil mandzhori wa suuil munqolibi fil maali wal ahli wal walad.','بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ.  اَللّٰهُ أَكْبَرُ. اَللّٰهُ أَكْبَرُ. اَللّٰهُ أَكْبَرُ. سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ. اللّٰهُمَّ إِنَّا نَسْأَلُكَ فِي سَفَرِنَا هٰذَا الْبِرَّ وَالتَّقْوٰى وَمِنَ الْعَمَلِ مَا تَرْضٰى. اَللّٰهُمَّ هَوِّنْ عَلَيْنَا سَفَرَنَا هَذَا وَأَطْوِ عَنَّا بُعْدَهُ. اَللّٰهُمَّ أَنْتَ الصَّاحِبُ فِي السَّفَرِ. وَالْخَلِيفَةُ فِي الْأَهْلِ. اَللّٰهُمَّ إِنِّي أَعُوْذُ بِكَ مِنْ وَعْثَاءِ السَّفَرِ وَكَأٓبَةِ الْمَنْظَرِ. وَسُوْءِ الْمُنْقَلَبِ فِي الْمَالِ وَالْأَهْلِ وَالْوَلَدِ','Dengan Nama Allah Yang Maha Pemurah lagi Maha Penyayang. Allah Maha Besar, Allah Maha Besar, Allah Maha Besar. Maha Suci Allah Yang telah menggerakkan untuk kami kendaraan ini padahal kami tiada kuasa menggerakkannya. Dan sesungguhnya kepada Tuhan, kami pasti akan kembali. Ya Allah, kami memohon kepada-Mu dalam perjalanan ini kebaikan dan takwa serta amal perbuatan yang Engkau ridhai. Ya Allah, mudahkanlah perjalanan ini dan dekatkanlah jaraknya bagi kami. Ya Allah, Engkaulah teman dalam bepergian dan pelindung terhadap keluarga yang ditinggalkan. Ya Allah, kami berlindung kepada-Mu dari kelelahan dalam bepergian, pemandangan yang menyedihkan, dan kepulangan yang menyusahkan dalam harta benda, keluarga, dan anak.',NULL,NULL,1,1,3,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(4,NULL,'Doa Ketika Mendekati Tempat Tujuan','Allahumma inni as aluka min khoiri hadzihil ardhi wa khoiri maa jumi\'at fiiha wa a\'udzubika min syarra haa wa syarra maa jumi\'at fiiha. Allahummarzuqna himaha, wa a\'idna min wabaha, wahabbabna ila ahliha, wa habbab sholihi ahliha ilaina.','اللّٰهُمَّ إِنِّي أَسْأَلُكَ مِنْ خَيْرِ هٰذِهِ الْأَرْضِ وَخَيْرِمَا جُمِعَتْ فِيْهَا وَأَعُوْذُ بِكَ مِنْ شَرِّهَا وَشَرِّ مَا جُمِعَتْ فِيْهَا. اَللّٰهُمَّ ارْزُقْنَا حِمَاهَا. وَأَعِدْنَا مِنْ وَبَاهَا. وَحَبِّبْنَا إِلَى أَهْلِهَا. وَحَبِّبْ صَالِحِي أَهْلِهَا إِلَيْنَا','Ya Allah, aku mohon yang terbaik dari bumi ini dan segala kebaikan yang terhimpun di dalamnya dan aku berlindung kepada-Mu dari keburukannya dan segala keburukan yang terhimpun di dalamnya. Ya Allah, berilah kami perlindungan, dan lindungilah kami dari wabahnya, buatlah kami dapat mencintai penduduknya dan penduduknya yang solih mencintai kami.',NULL,NULL,1,1,4,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(5,NULL,'Doa ketika Tiba di Tempat Tujuan','Allahumma inni as aluka khairaha wa khaira ma fiha wa khaira ma arsalta bihi ahlihaa wa a\'udzubika min syarrahaa wa syarra ahlihaa wasyarra maa fiha wa syarra ma arsaltabih.','اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَهَا وَخَيْرَمَا فِيْهَا وَخَيْرَمَا أَرْسَلْتَ بِهِ أَهْلِهَا وَأَعُوْذُ بِكَ مِنْ شَرِّهَا وَشَرِّ أَهْلِهَا وَشَرِّ مَا فِيْهَا وَشَرِّ مَا أَرْسَلْتَ بِهِ','Ya Allah, aku memohon pada-Mu kebaikan negeri ini dan kebaikan penduduknya serta kebaikan yang ada di dalamnya. Dan aku berlindung pada-Mu dari kejahatan negeri ini dan kejahatan penduduknya.',NULL,NULL,1,1,5,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(6,NULL,'Niat Umrah Versi I','Labbaikallahumma ‘umratan','لَبَّيْكَ اللّٰهُمَّ عُمْرَةً','Aku sambut panggilan-Mu Ya Allah untuk berumrah.',NULL,NULL,1,1,6,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(7,NULL,'Niat Umrah Versi II','Nawaitul \'umrata wa ahramtu bihi lillahi ta\'ala.','نَوَيْتُ اْلعُمْرَةَ وَأَحْرَمْتُ بِهَا لِلَّهِ تَعَالَى','Aku berniat umrah dengan berihram karena Allah Ta\'ala.',NULL,NULL,1,1,7,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(8,NULL,'Niat Haji Versi I','Labbaikallaahumma hajjan','لَبَّيْكَ اللَّهُم حَجَّا','Aku sambut panggilan-Mu Ya Allah untuk berhaji',NULL,NULL,1,1,8,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(9,NULL,'Niat Haji Versi II','Nawaitul hajja wa ahramtu bihi lillahi ta\'ala.','نَوَيْتُ الْحَجَّ وَأَحْرَمْتُ بِهِ لِلَّهِ تَعَالَي','Aku niat haji dengan berihram karena Allah Ta\'ala.',NULL,NULL,1,1,9,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(10,NULL,'Niat Haji Qiran Versi I','Labbaikallaahumma hajjan wa umratan','لَبَّيْكَ اللّٰهُمَّ حَجًّا وَعُمْرَةً','Aku datang memenuhi panggilan-Mu Ya Allah untuk berhaji dan umrah.',NULL,NULL,1,1,10,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(11,NULL,'Niat Haji Qiran  Versi II','Nawaitul hajja wal \'umrata wa ahramtu bihima lillahi ta\'ala.','نَوَيْتُ الْحَجَّ وَالْعُمْرَةَ وَأَحْرَمْتُ بِهِمَا لِلَّهِ تَعَالَى ','Aku niat haji dan umrah dengan berihram untuk haji dan umrah karena Allah Ta\'ala.',NULL,NULL,1,1,11,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(12,NULL,'Doa Selesai Berihram','Allahumma uharrimu sya\'ri wa basyari wa jasadi wa jami\'a jawarihi min kulli syai-in harramtahu \'alal muhrimi abtaghi bidzalika wajhakal karim ya rabbal \'alamin.','اللَّهُمَّ أُحَرِّمُ شَعْرِي وَبَشَرِيْ وَجَسَدِيْ وَجَمِيْعَ جَوَارِحِيْ مِنْ كُلِّ شَيْءٍ حَرَّمْتَهُ عَلَى الْمُحْرِمِ أَبْتَغِي بِذلِكَ وَجْهَكَ الْكَرِيْمَ يَارَبَّ الْعَالَمِيْنَ','Ya Allah, aku haramkan rambut, kulit, tubuh, dan seluruh anggota tubuhku dari semua yang Engkau haramkan bagi seorang yang sedang berihram, demi mengharapkan diri-Mu semata, wahai Tuhan pemelihara alam semesta.',NULL,NULL,1,1,12,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(13,NULL,'Bacaan Talbiyah','Labbaikallahuma labbaik, labbaika laa syariika laka labbaik, innal hamda wa ni\'mata laka wal mulk laa syarika laka.','لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيْكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالمُلْكَ لاَ شَرِيكَ لَكَ','Aku sambut panggilan-Mu ya Allah, aku sambut panggilan-Mu, aku sambut panggilan-Mu tidak ada sekutu bagi-Mu, aku sambut panggilan-Mu. segala puji, kemuliaan, dan segenap kekuasaan adalah milik-Mu, tidak ada sekutu bagi-Mu.',NULL,NULL,1,1,13,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(14,NULL,'Bacaan Sholawat','Allahumma shalli wa sallim \'ala sayyidina Muhammad wa \'ala ali sayyidina Muhammad.','اللَّهُمَّ صَلِّ وَسَلّمْ عَلَى سَيِّدِنَا مُحَمَّدٍ وَعَلَىٰ أَلِ سَيِّدِنَا مُحَمَّدٍ','Ya Allah, limpahkan rahmat dan keselamatan kepada Nabi Muhammad SAW dan keluarganya.',NULL,NULL,1,1,14,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(15,NULL,'Doa Sesudah Sholawat','Allahumma inna nas aluka ridhaka wal jannah, wana\'udzu bika min sakhatika wan nar, rabbana atina fiddunya hasanah, wa fil akhirati hasanah wa qina \'adzaban naar.','اللَّهُمَّ إِنَّا نَسْأَلُكَ رِضَاكَ وَالْجَنَّةَ وَنَعُوْذُ بِكَ مِنْ سَخَطِكَ والنَّارِ. اَللَّهُمَّ رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ','Ya Allah, sesungguhnya kami memohon keridhaan-Mu dan surga, kami berlindung pada-Mu dari murka-Mu dan siksa neraka. Wahai Tuhan kami, berilah kami kebaikan di dunia dan kebaikan di akhirat serta hindarkanlah kami dari siksa neraka.',NULL,NULL,1,1,15,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(16,NULL,'Doa Memasuki Kota Makkah','Allaahumma haadzaa haramuka wa amnuka faharrim lahmii wadamii wasya\'rii wabasyarii \'alan-naari wa aaminnii min \'adzaabika yauma tab\'atsu \'ibaadaka waj\'alnii min auliyaa-ika wa-ahli thaa\'atika','اَللّٰهُمَّ هٰذَا حَرَمُكَ وَأَمْنُكَ فَحَرِّمْ لَحْمِي وَدَمِيْ وَشَعْرِي وَبَشَرِيْ عَلَى النَّارِ وَأٰمِنِّي مِنْ عَذَابِكَ يَوْمَ تَبْعَثُ عِبَادَكَ وَاجْعَلْنِي مِنْ أَوْلِيَآئِكَ وَأَهْلِ طَاعَتِكَ','Ya Allah, kota ini adalah tanah haram-Mu dan tempat aman-Mu, maka hindarkanlah daging, darah, rambut, dan kulitku dari neraka. Dan selamatkanlah diriku dari siksa-Mu pada hari Engkau membangkitkan kembali hamba-Mu, dan jadikanlah aku termasuk orang- orang yang selalu dekat dan taat kepada-Mu.',NULL,NULL,1,1,16,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(17,NULL,'Doa Masuk Masjidil Haram','Allaahumma antas salaamu waminkas salaamu wailaika ya\'uudus salaamu fahayyinaa rabbanaa bis-salaami wa- adkhilnal jannata daaras salaami tabaarakta rabbanaa wata\'aalaita yaa dzal jalaali wal-ikraami. Allaahummaftah lii abwaaba rahmatika. Bismillaahi walhamdu lillaahi wash-shalaatu was- salaamu \'alaa rasuulillaahi.','اَللّٰهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ وَإِلَيْكَ يَعُوْدُ السَّلَامُ فَحَيِّنَا رَبَّنَا بِالسَّلَامِ وَأَدْخِلْنَا الْجَنَّةَ دَارَالسَّلَامِ تَبَارَكْتَ رَبَّنَا وَتَعَالَيْتَ يَا ذَالْجَلَالِ وَالْإِكْرَامِ. اَللّٰهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ. بِسْمِ اللَّهِ وَالْحَمْدُ لِلَّهِ وَالصَّلَاةُ وَالسَّلَامُ عَلَى رَسُوْلِ اللّٰهِ','Ya Allah, Engkau sumber keselamatan dan daripada-Mulah datangnya keselamatan dan kepada-Mu kembalinya keselamatan. Maka hidupkanlah kami wahai Tuhan, dengan selamat sejahtera dan masukkanlah kami ke dalam surga negeri keselamatan. Maha Banyak anugerah-Mu dan Maha Tinggi Engkau wahai Tuhan yang memiliki keagungan dan kehormatan. Ya Allah, bukakanlah untukku pintu-pintu rahmat-Mu (aku masuk masjid ini) dengan nama Allah disertai dengan segala puji bagi Allah serta shalawat dan salam untuk Rasulullah.',NULL,NULL,1,1,17,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(18,NULL,'Doa ketika Melihat Ka\'bah','Allaahumma zid haadzal baita tasyriifan wata\'zhiiman wamahaabatan. Wazid man syarrafahu wakarramahu mimman hajjahu awi\'tamarahu tasyriifan wa ta\'zhiiman wa takriiman wabirran.','اَللّٰهُمَّ زِدْ هٰذَا الْبَيْتَ تَشْرِيْفًا وَتَعْظِيمًا وَتَكْرِيمًا وَمَهَابَةً. وَزِدْ مَنْ شَرَّفَهُ وَكَرَّمَهُ مِمَّنْ حَجَّهُ أَوِ اعْتَمَرَهُ تَشْرِيفًا وَتَعْظِيمًا وَتَكْرِيمًا وَبِرًّا','Ya Allah, tambahkanlah kemuliaan, keagungan, kehormatan, dan wibawa pada Bait (Ka\'bah) ini. Dan tambahkan pula pada orang-orang yang memuliakan, mengagungkan, dan menghormatinya di antara mereka yang berhaji atau yang berumrah dengan kemuliaan, keagungan, kehormatan, dan kebaikan.',NULL,NULL,1,1,18,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(19,NULL,'Doa Tawaf','Bismillāhi allāhu akbar.','بِسْمِ اللَّهِ اَللّٰهُ أَكْبَرُ','Dengan nama Allah, Allah Maha Besar.',NULL,NULL,1,1,19,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(20,NULL,'Thawaf Putaran Pertama - Hajar Aswad sampai Rukun Yamani','Subhaanallaahi, walhamdulillaahi, walaa ilaaha illallaahu wallaahu akbaru, walaa haula walaa quwwata illaa billaahil \'aliyyil \'azhiimi, wash-shalaatu was-salaamu \'alaa rasuulillaahi shallallaahu \'alaihi wasallama. Allaahumma iimaanan bika wa tashdiiqan bikitaabika, wa wafaaan bi\'ahdika, wattibaa\'an lisunnati nabiyyika Muhammadin shallallaahu \'alaihi wasallama. Allaahumma innii as-alukal \'afwa, wal-\'aafiyata, wal-mu\'aafaatad daa-imata, fid- diini wad-dunyaa wal-aakhirata, wal-fauza bil- jannati, wan-najaata minan-naar.','سُبْحَانَ اللّٰهِ وَالْحَمْدُ لِلّٰهِ وَلَا إِلَهَ إِلَّا اللّٰهُ وَاللّٰهُ أَكْبَرُ وَلَاحَوْلَ وَلَا قُوَّةَ إِلَّا بِاللّٰهِ الْعَلِيّ الْعَظِيمِ وَالصَّلَاةُ وَالسَّلامُ عَلَى رَسُوْلِ اللّٰه صَلَّى اللَّه عَلَيْهِ وَسَلَّمَ. اللَّهُمَّ إِيْمَانًا بِكَ وَتَصْدِيقًا بِكِتَابِكَ وَوَفَاءً بِعَهْدِكَ وَاتِّبَاعًا لِسُنَّةِ نَبِيِّكَ مُحَمَّدٍ صَلَّى اللّٰهُ عَلَيْهِ وَسَلَّمَ. اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ وَالْمُعَافَاةَ الدَّائِمَةَ فِي الدِّيْنِ وَالدُّنْيَا وَالْأَخِيرَةِ وَالْفَوْزَ بِالْجَنَّةِ وَالنَّجَاةَمِنَ النَّارِ','Maha Suci Allah, segala puji bagi Allah, tidak ada Tuhan selain Allah, Allah Maha Besar. Tiada daya (untuk memperoleh manfaat) dan tiada kemampuan (untuk menolak bahaya) kecuali dengan pertolongan Allah Yang Maha Mulia dan Maha Agung. Shalawat dan salam bagi Rasulullah SAW. Ya Allah, aku thawaf ini karena beriman kepada-Mu, membenarkan kitab-Mu dan memenuhi janji-Mu dan mengikuti sunnah Nabi-Mu Muhammad SAW. Ya Allah, sesungguhnya aku mohon kepada-Mu ampunan. Kesehatan dan perlidungan yang kekal dalam menjalankan agama, di dunia dan di akhirat dan beruntung memperoleh surga dan terhindar dari siksa neraka','prayers/default/audio/doa_thawaf/thawaf_putaran_1.mp3',NULL,1,1,20,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(21,NULL,'Thawaf Putaran Kedua - Hajar Aswad sampai Rukun Yamani','Allaahumma inna haadzal baita baituka wal-harama haramuka, wal-amna amnuka, wal-\'abda \'abduka, wa ana \'abduka wabnu \'abdika, wa haadzaa maqaamul \'aa-idzi bika minan naari, faharrim luhuumanaa wa- basyaratanaa \'alan naari. Allaahumma hab- bib ilainal iimaana, wa zayyinhu fii quluu- binaa wa karrih ilainal kufra wal-fusuuqa wal-\'ishyaana, waj\'alnaa minar raasyidii- na. Allaahumma qinii \'adzaabaka yauma tab\'atsu \'ibaadaka, Allaahummarzuqnil jannata bighairi hisaab.','اَللّٰهُمَّ إِنَّ هٰذَا الْبَيْتَ بَيْتُكَ وَالْحَرَمَ حَرَمُكَ وَالْأَمْنَ أَمْنُكَ وَالْعَبْدَ عَبْدُكَ وَأَنَا عَبْدُكَ وَابْنُ عَبْدِكَ وَهٰذَا مَقَامُ الْعَائِذِ بِكَ مِنَ النَّارِ . فَحَرِّمْ لُحُوْمَنَا وَبَشَرَتَنَا عَلَى النَّارِ. اَللَّهُمَّ حَبِّبْ إِلَيْنَا الْإِيْمَانَ وَزَيِّنْهُ فِي قُلُوْبِنَا وَكَرِّهْ إِلَيْنَا الْكُفْرَ وَالْفُسُوْقَ وَالْعِصْيَانَ وَاجْعَلْنَا مِنَ الرَّاشِدِيْنَ . اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ. اللَّهُمَّ ارْزُقْنِي الْجَنَّةَ بِغَيْرِ حِسَابٍ','Ya Allah, sesungguhnya Bait ini rumah-Mu, tanah mulia ini tanah-Mu, negeri aman ini negeri-Mu, hamba ini hamba-Mu anak dari hamba-Mu, dan tempat ini adalah tempat orang berlindung pada-Mu dari siksa neraka, maka haramkanlah daging dan kulit kami dari siksa neraka. Ya Allah, cintakanlah kami pada iman dan biarkanlah ia menghias hati kami, tanamkanlah kebencian pada diri kami pada perbuatan kufur, fasiq, maksiat dan durhaka serta masukkanlah kami dalam golongan orang yang mendapat petunjuk. Ya Allah, lindungilah aku dari azab-Mu di hari Engkau kelak membangkitkan hamba- hamba-Mu. Ya Allah anugerahkanlah surga kepadaku tanpa hisab.','prayers/default/audio/doa_thawaf/thawaf_putaran_2.mp3',NULL,1,1,21,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(22,NULL,'Thawaf Putaran Ketiga - Hajar Aswad sampai Rukun Yamani','Allaahumma innii a\'uudzu bika minasy syakki wasy-syirki wasy-syiqaaqi wan- nifaaqi wasuu-il akhlaaqi wasuu-il manzhari wal-munqalabi fil-maali wal-ahli wal-waladi. Allaahumma innaa nas-aluka ridhaaka wal-jannata wa na\'uudzu bika min sakhathika wan-naari. Allaahumma innii a\'uudzu bika min fitnatil qabri wa a\'uudzu bika min fitnatil mahyaa wal- mamaat.','اَللّٰهُمَّ إِنِّي أَعُوْذُبِكَ مِنَ الشَّكِّ وَالشِّرْكِ وَالشِّقَاقِ وَالنِّفَاقِ وَسُوْءِ الْأَخْلَاقِ وَالْمَنْظَرِ وَالْمُنْقَلَبِ فِيْ الْمَالِ وَالْأَهْلِ وَالوَلَدِ. اَللّٰهُمَّ إِنِّي أَسْأَلُكَ رِضَاكَ وَالْجَنَّةَ وَأَعُوْذُبِكَ مِنْ سَخَطِكَ وَالنَّارِ . اَللّٰهُمَّ إِنِّي أَعُوْذُبِكَ مِنْ فِتْنَةِ الْقَبْرِ وَأَعُوْذُبِكَ مِنْ فِتْنَةِ الْمَحْيَاوَالْمَمَاتِ','Ya Allah, aku berlindung kepada-Mu dari keraguan, syirik, percekcokan, kemunafikan, buruk budi pekerti dan penampilan dan kepulangan yang jelek dalam hubungan dengan harta benda, keluarga dan anak-anak. Ya Allah, sesungguhnya aku mohon kepada- Mu keridhaan-Mu dan surga. Dan aku berlindung pada- Mu daripada murka-Mu dan siksa neraka. Ya Allah, aku berlindung pada-Mu dari fitnah kubur, dan aku berlindung pada-Mu dari fitnah kehidupan dan derita kematian.','prayers/default/audio/doa_thawaf/thawaf_putaran_3.mp3',NULL,1,1,22,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(23,NULL,'Thawaf Putaran Keempat - Hajar Aswad sampai Rukun Yamani','Allaahummaj\'alhu hajjan mabruuran, wa sa\'yan masykuuran, wa dzanban maghfuuran, wa \'amalan shaalihan maqbuulan, wa tijaaratan lan tabuura. Yaa \'aalimu maa fish-shuduuri, akhrijnii ya Allaahu minazh-zhulumaati ilan-nuuri','اَللّٰهُمَّ اجْعَلْهُ حَجًّا مَبْرُوْرًا وَسَعْيًا مَشْكُورًا وَذَنْبًا مَغْفُوْرًا وَعَمَلاً صَالِحًا مَقْبُوْلاً وَتِجَارَةً لَنْ تَبُوْرَ.  يَا عَالِمَ مَا فِي الصُّدُوْرِ أَخْرِجْنِي يَا اَللّٰهُ مِنَ الظُّلُمَاتِ إِلَى النُّوْرِ','Ya Allah karuniakanlah umrah yang maqbul, sa\'i yang diterima, dosa yang diampuni, amal shaleh yang diterima dan usaha yang tidak akan mengalami rugi. Wahai Tuhan yang Maha Mengetahui apa-apa yang terkandung dalam hati sanubari. Keluarkanlah aku dari kegelapan ke cahaya yang terang benderang.','prayers/default/audio/doa_thawaf/thawaf_putaran_4.mp3',NULL,1,1,23,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(24,NULL,'Thawaf Putaran Kelima - Hajar Aswad sampai Rukun Yamani','Allaahumma azhillanii tahta zhilli \'arsyika yaumalaazhillaillaazhilluka walaa baaqiya illaa wajhuka, wa asqinii min haudhi nabiyyika Muhammadin shallallaahu \'alaihi wasallama syurbatan hanii\'atan marii-atan, laa azhma\'u ba\'dahaa abada. Allaahumma innii as-aluka min khairi maa sa-alaka minhu nabiyyuka Muhammadin shallallaahu \'alaihi wasallama, wa-a\'uudzu bika min syarri masta\'aadzaka minhu nabiyyuka Muhammadin shallallaahu \'alaihi wasallama. Allaahumma innii as- alukal jannata wa na\'iimahaa wamaa yuqarribunii ilaihaa min qaulin au fi\'lin au \'amalin, wa-a\'uudzu bika minan naari wamaa yuqarribunii ilaihaa min qaulin au fi\'lin au \'amal.','اَللّٰهُمَّ أَظِلَّنِي تَحْتَ ظِلِّ عَرْشِكَ يَوْمَ لَا ظِلَّ إِلَّا ظِلُّكَ وَلَا بَاقِيَ إِلَّا وَجْهُكَ وَاَسْقِنِي مِنْ حَوْضِ نَبِيِّكَ مُحَمَّدٍ صَلَّى اللّٰهُ عَلَيْهِ وَسَلَّمَ شُرْبَةً هَنِيئَةً مَرِيئَةً لَا أَظْمَأُ بَعْدَهَا أَبَدًا. اَللّٰهُمَّ إِنِّي أَسْأَلُكَ مِنْ خَيْرٍ مَا سَأَلَكَ مِنْهُ نَبِيُّكَ مُحَمَّدٌ صَلَّى اللّٰهُ عَلَيْهِ وَسَلَّمَ وَأَعُوْذُبِكَ مِنْ شَرِّ مَا اسْتَعَاذَكَ مِنْهُ نَبِيُّكَ مُحَمَّدٌ صَلَّى اللّٰهُ عَلَيْهِ وَسَلَّمَ . اَللّٰهُمَّ إِنِّي أَسْأَلُكَ الْجَنَّةَ وَنَعِيْمَهَا وَمَا يُقَرِّبُنِي إِلَيْهَا مِنْ قَوْلٍ أَوْ فِعْلٍ أَوْ عَمَلٍ وَأَعُوْذُبِكَ مِنَ النَّارِ وَمَا يُقَرِّبُنِي إِلَيْهَا مِنْ قَوْلٍ أَوْ فِعْلٍ أَوْ عَمَلٍ','Ya Allah, lindungilah kami di bawah naungan singgasana-Mu pada hari yang tidak ada naungan selain naunganMu dan tidak ada yang kekal kecuali Zat-Mu. Ya Allah, berilah aku minuman dari telaga Nabi Muhammad SAW dengan suatu minuman yang sesudah itu aku tidak akan haus untuk selamanya. Ya Allah, aku mohon pada-Mu kebaikan yang dimohonkan oleh Nabi-Mu Muhammad SAW dan aku berlindung pada-Mu dari kejahatan yang dimintakan perlindungan oleh Nabi-Mu Muhammad SAW. Ya Allah, aku mohon pada-Mu surga serta nikmatnya dan apapun yang dapat mendekatkan aku kepadanya, baik ucapan maupun amal perbuatan dan aku berlindung pada-Mu dari neraka serta apapun yang mendekatkan aku kepadany baik ucapan ataupun amal perbuatan, dan aku mohon pada-Mu agar menjadikan semua takdirku dengan takdir yang baik.','prayers/default/audio/doa_thawaf/thawaf_putaran_5.mp3',NULL,1,1,24,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(25,NULL,'Thawaf Putaran Keenam - Hajar Aswad sampai Rukun Yamani','Allahumma inna laka \'alayya huquuqan katsiirata fiimaa bainii wa bainaka wa huquuqan katsiiratan fiimaa baitii wa baina khalqika. Allaahumma maa kaana laka minhaa faghfirhu lii wamaa kaana likhalqika fatahammalhu \'annii, wa aghninii bihalaalika \'an haraamika, wa bithaa\'atika \'an ma\'shiyatika, wa bifadhlika \'amman siwaaka, yaa waasi\'al maghfirah. Allaahumma inna baitaka \'azhiimun, wa wajhaka kariimun, wa anta yaa Allaahu haliimun, kariimun \'azhiimun tuhibbul \'afwa fa\'fu \'annii.','اَللّٰهُمَّ إِنَّ لَكَ عَلَيَّ حُقُوْقًا كَثِيرَةً فِيْمَا بَيْنِي وَبَيْنَكَ وَحُقُوْقًا كَثِيرَةً فِيْمَا بَيْنِي وَبَيْنَ خَلْقِكَ. اَللّٰهُمَّ مَا كَانَ لَكَ مِنْهَا فَاغْفِرْهُ لِي وَمَا كَانَ لِخَلْقِكَ فَتَحَمَّلْهُ عَنِّي وَأَغْنِنِي بِحَلَالِكَ عَنْ حَرَامِكَ وَبِطَاعَتِكَ عَنْ مَعْصِيَتِكَ وَبِفَضْلِكَ عَمَّنْ سِوَاكَ يَا وَاسِعَ الْمَغْفِرَةِ. اَللّٰهُمَّ إِنَّ بَيْتَكَ عَظِيمٌ وَوَجْهَكَ كَرِيمٌ وَأَنْتَ يَا اللّٰه حَلِيمٌ كَرِيمٌ عَظِيمٌ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي','Ya Allah, sesungguhnya Engkau mempunyai hak kepadaku banyak sekali hak dalam hubunganku dengan Engkau dan Engkau juga mempunyai hak banyak sekali dengan makhluk-Mu. Ya Allah, apa yang menjadi hak-Mu kepadaku, maka ampunilah diriku dan apa saja yang menjadi hak-Mu kepada makhluk-Mu, maka tanggunglah dariku. Cukupkanlah aku dengan rezeki-Mu yang halal, terhindar dari yang haram, dengan taat kepada-Mu, terhindar dari kemaksiatan dan dengan anugerah-Mu terhindar dari pada mengharapkan dari orang lain selain kepada-Mu, Wahai Tuhan Yang Maha Pengampun. Ya Allah, sesungguhnya rumah-Mu (Baitullah) ini Agung, Zat-Mu pun Mulia. Engkau Maha Penyabar, Maha Pemurah, Maha Agung yang sangat suka memberi ampun, maka ampunilah aku.','prayers/default/audio/doa_thawaf/thawaf_putaran_6.mp3',NULL,1,1,25,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(26,NULL,'Thawaf Putaran Ketujuh - Hajar Aswad sampai Rukun Yamani','Allaahumma innii as-aluka iimaanan kaamilan, wa yaqiinan shaadiqan, wa rizqan waasi\'an, wa qalban khaasyi\'an, wa lisaanan dzaakiran, wa rizqan halalan thayyiban, wa taubatan nashuuhan, wa taubatan qablal mauti, wa rahatan \'indal mauti, wa maghfiratan wa rahmatan ba\'dal mauti, wal-\'afwa\'indal hisaabi, wal fauza bil-jannati, wan-najaata minan naari, birahmatika yaa \'aziizu yaa ghaffaaru. Rabbi zidnii ilman wa-alhiqnii bish-shaalihiin','اَللّٰهُمَّ إِنِّي أَسْأَلُكَ إِيْمَانًا كَامِلاً وَيَقِينًا صَادِقًا وَرِزْقًا وَاسِعًا وَقَلْبًا خَاشِعًا وَلِسَانًا ذَاكِرًا وَرِزْقًا حَلَالاً طَيِّبًا وَتَوْبَةً نَصُوحًا وَتَوْبَةً قَبْلَ الْمَوْتِ وَرَاحَةً عِنْدَ الْمَوْتِ وَمَغْفِرَةً وَرَحْمَةً بَعْدَ الْمَوْتِ وَالْعَفْوَ عِنْدَ الْحِسَابِ وَالْفَوْزَ بِالْجَنَّةِ وَالنَّجَاةَ مِنَ النَّارِ بِرَحْمَتِكَ يَا عَزِيزُ يَا غَفَّارُ . رَبِّ زِدْنِي عِلْمًا وَأَلْحِقْنِي بِالصَّالِحِيْنَ','Ya Allah, aku mohon pada-Mu iman yang sempurna, keyakinan yang benar, ilmu yang bermanfaat, rezeki yang luas, rezeki yang halal dan baik, hati yang khusyu\', lidah yang selalu berzikir, taubat yang semurni murninya dan taubat sebelum mati, ampunan dan rahmat sesudah mati.\n\nYa Allah aku mohon kepadamu ketenangan ketika mati dan ampunan ketika hisab, serta keberuntungan dengan memperoleh surga dan terhindar dari neraka dengan kasih sayangMu. Wahai Tuhan Yang Maha Perkasa, Yang Maha Pengampun. Tuhanku, tambahan ilmu pengetahuan dan gabungkan aku ke dalam golongan orang-orang yang saleh.','prayers/default/audio/doa_thawaf/thawaf_putaran_7.mp3',NULL,1,1,26,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(27,NULL,'Rukun Yamani - Hajar Aswad','Rabbanaa aatinaa fid-dunyaa hasanatan wafil-aakhirati hasanatan waqinaa \'adzaaban naar. ','رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ','Wahai Tuhan kami, berilah kami kebaikan di dunia dan kebaikan di akhirat, dan hindarkanlah kami dari siksa neraka. Dan masukkanlah kami ke dalam surga bersama orang-orang yang berbuat baik, wahai Tuhan Yang Maha Perkasa, Maha Pengampun dan Tuhan yang menguasai seluruh alam','prayers/default/audio/doa_thawaf/rukun_yamani_hajar_aswad.mp3',NULL,1,1,27,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(28,NULL,'Doa Minum Air Zam Zam','Allaahumma innii as-aluka \'ilman naafi\'an, wa rizqan waasi\'an, wa syifaa-an min kulli daa-in wa saqamin, birahmatika yaa arhamar raahimiin.','اَللّٰهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا وَرِزْقًا وَاسِعًا وَشِفَاءً مِنْ كُلِّ دَاءٍ وَسَقَمٍ بِرَحْمَتِكَ يَا أَرْحَمَ الرَّاحِمِينَ','Ya Allah, aku mohon pada-Mu ilmu pengetahuan yang bermanfaat, rizki yang luas dan kesembuhan dari segala penyakit dan kepedihan dengan rahmat-Mu ya Allah Tuhan Yang Maha Pengasih dari segenap yang pengasih.',NULL,NULL,1,1,28,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(29,NULL,'Doa Ketika hendak mendaki bukit Shafa sebelum mulai Sa\'i','Bismillaahir rahmaanir rahiim. Abda-u bi- maa bada-Allaahu bihi wa rasuulihi, innashshafaa wal-marwata min sya\'aa-irillaahi, faman hajjal baita awi\'tamara falaa ju- naaha \'alaihi an yaththawwafa bihimaa wa man tathawwa\'a khairan fa-innallaaha syaakirun \'aliim.','بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ. أَبْدَأُ بِمَا بَدَأَ اللّٰهُ بِهَ وَرَسُوْلُهُ . إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَائِرِ اللَّهِ. فَمَنْ حَجَّ الْبَيْتَ أَوِعْتَمَرَ فَلاَ جُنَاحَ عَلَيْهِ أَنْ يَطَوَّفَ بِهِمَا وَمَنْ تَطَوَّعَ خَيْرًا فَإِنَّ اللّٰهَ شَاكِرٌ عَلِيمٌ','Dengan nama Allah yang Maha Pengasih lagi Maha Penyayang. Aku mulai dengan apa yang telah dimulai oleh Allah dan rasul-Nya. Sesungguhnya Shafa dan Marwah sebagian dari syiar-syiar (tanda kebesaran) Allah. Maka barangsiapa yang beribadah haji ke Baitullah atau pun berumrah, maka tidak ada dosa baginya mengerjakan Sa\'i antara keduanya. Dan barangsiapa yang mengerjakan suatu kebajikan dengan kerelaan hati, maka sesungguhnya Allah Maha Penerima Kebaikan lagi Maha Mengetahui.',NULL,NULL,1,1,29,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(30,NULL,'Doa di atas bukit Shafa ketika menghadap Ka\'bah','Allaahu akbar, Allaahu akbar, Allaahu akbar, wa lillaahil hamd, Allaahu akbaru \'alaa maa hadaanaa walhamdu lillaahi \'alaa maa aulaanaa. Laa ilaaha illallaahu wahdahu laa syariika lahu, lahul mulku wa lahul hamdu yuhyii wa yumiitu biyadihil khairu wa huwa \'alaa kulli syai-in qadiir. Laa ilaaha illallaahu wahdahu laa syariika lahu anjaza wa\'dahu wa nashara \'abdahu wa hazamal ahzaaba wahdahu laa ilaaha illallaahu walaa na\'budu illaa iyyaahu mukhlishiina lahud diina walau karihal kaafiruun','اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ وَلِلّٰهِ الْحَمْدُ. اللّٰهُ أَكْبَرُ عَلَى مَا هَدَانَا وَالْحَمْدُ لِلَّهِ عَلَى مَا أَوْلَانَا . لَا إِلَهَ إِلَّا اللّٰهُ وَحْدَهُ لَا شَرِيْكَ لَهُ. لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ يُحْيِي وَيُمِيْتُ بِيَدِهِ الْخَيْرِ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ . لَا إِلَهَ إِلَّا اللّٰهُ وَحْدَهُ لَا شَرِيْكَ لَهُ أَنْجَزَ وَعْدَهُ وَنَصَرَ عَبْدَهُ وَهَزَمَ الأَحْزَابَ وَحْدَهُ لاَ إِلَهَ إِلَّا اللّٰهُ وَلَا نَعْبُدُ إِلَّا إِيَّاهُ مُخْلِصِينَ لَهُ الدِّيْنَ وَلَوْ كَرِهَ الْكَافِرُوْنَ','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar. Segala puji bagi Allah, Allah Maha Besar, atas petunjuk yang diberikan-Nya kepada kami, segala puji bagi Allah atas karunia yang telah dianugerahkan- Nya kepada kami, tidak ada Tuhan selain Allah Yang Maha Esa, tidak ada sekutu bagi-Nya. Bagi-Nya kerajaan dan pujian. Dialah yang menghidupkan dan mematikan, pada kekuasaan-Nya lah segala kebaikan dan Dia berkuasa atas segala sesuatu. Tiada Tuhan selain Allah Yang Maha Esa, tidak ada sekutu bagi-Nya, yang telah menepati janji-Nya, menolong hamba-Nya, dan menghancurkan sendiri musuh-musuh-Nya. Tidak ada Tuhan selain Allah dan kami tidak menyembah kecuali kepada-Nya dengan memurnikan (ikhlas) kepatuhan semata kepada- Nya walaupun orang-orang kafir membenci.',NULL,NULL,1,1,30,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(31,NULL,'Doa Sa\'i Perjalanan Pertama dari Bukit Shafa ke Marwah','Allaahu akbar, Allaahu akbar, Allaahu akbar. Allaahu akbaru kabiira, walhamdu lillaahi katsiira, wa subhaanal \'azhiimi wa bihamdihil kariimi, bukratan wa-ashiilaa, wa minal laili fasjud lahu, wa sabbihhu lailan thawiilan laa ilaaha illallaahu wahdahu, anjaza wa\'dahu, wa nashara \'abdahu, wa hazamal ahzaaba wahdahu, laa syai-a qablahu walaa ba\'dahu, yuhyii wa yumiitu, wa huwa hayyun daa-imun, laa yamuutu walaa yafuutu abadan, biyadihil khair, wa-ilaihil mashiir, wa huwa \'alaa kulli syai-in qadiir','اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ. اَللّٰهُ أَكْبَرُ كَبِيرًا وَالْحَمْدُ لِلّٰهِ كَثِيرًا وَسُبْحَانَ اللّٰهِ الْعَظِيمِ وَبِحَمْدِهِ الْكَرِيمِ بُكْرَةً وَأَصِيْلاً وَمِنَ اللَّيْلِ فَاسْجُدْ لَهُ وَسَبِّحْهُ لَيْلا طَوِيلاً لَا إِلَهَ إِلَّا اللّٰه وَحْدَهُ أَنْجَزَ وَعْدَهُ وَنَصَرَ عَبْدَهُ وَهَزَمَ الْأَحْزَابَ وَحْدَهَ لَا شَيْئَ قَبْلَهُ وَلَا بَعْدَهُ يُحْيِ وَيُمِيْتُ وَهُوَ حَيٌّ دَائِمٌ لَا يَمُوْتُ وَلَا يَفُوْتُ أَبَدًا بِيَدِهِ الْخَيْرِوَإِلَيْهِ الْمَصِيرُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar, Allah Maha Besar dengan segala kebesaran- Nya. Segala puji bagi Allah Yang Maha Agung dengan segala pujian-Nya yang tidak terhingga. Maha Suci Allah Yang Maha Agung dengan pujian, Yang Maha Mulia di waktu pagi dan petang. Dan pada sebagian malam, bersujud dan bertasbihlah pada-Nya sepanjang malam. Tidak ada Tuhan selain Allah Yang Maha Esa yang menepati janji-Nya membela hamba-hamba-Nya yang menghancurkan musuh-musuh-Nya dan tidak ada sesuatu sebelum-Nya dan tidak ada sesuatu pun sesudah- Nya. Dialah yang menghidupkan dan mematikan dan Dia adalah Maha Hidup Kekal tiada mati dan tiada musnah (hilang) untuk selama-lamanya. Hanya di tangan-Nyalah terletak kebajikan dan kepada-Nyalah tempat kembali dan hanya Dialah Yang Maha Kuasa atas segala sesuatu','prayers/default/audio/doa_sai/sai_putaran_1.mp3',NULL,1,1,31,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(32,NULL,'Doa Sa\'i Perjalanan Kedua dari Bukit Shafa ke Marwah','Allahu Akbar, Allahu Akbar, Allahu Akbar, wa lillahil-hamd. Laa ilaaha illallahul waahidul fardush-shamad, alladzii lam yattakhidz shaahibatan wa laa waladan, wa lam yakun lahuu syariikun fil-mulki, wa lam yakun lahuu waliyyun minadz- dzulli, wa kabbirhu takbiiran. Allaahumma innaka qulta fii kitaabikal-munazzal, ud\'uu- nii astajib lakum, da\'aunaaka rabbanaa faghfir lanaa, kamaa wa\'adtanaa, innaka laa tukhliful-mii\'aad. Rabbanaa innanaa sami\'naa munaadiyan yunaadii lil-iimaani an aaminuu birabbikum fa aamannaa. Rabbanaa faghfir lanna dzunuubanaa wa kaffir \'annaa sayyi-aatinaa wa thawaffanaa ma\'al-abraar. Rabbanaa wa aatinaa maa wa\'adtanaa \'alaa rusulika walaa tukhzinaa yaumal-qiyaamati, innaka laa tukhliful- mii\'aad. Rabanaa \'alaika tawakkalnaa wa ilaika anabnaa wa ilaikal-mashiir. Rabbanaghfir lanaa dzunuubanaa wa li ikhwaaninal-ladziina sabaquunaa bil- iimaani, wa laa taj\'al fi quluubinaa ghillan lilladziina aamanuu rabbanaa innaka ra- uufur-rahiim.','اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ وَلِلَّهِ الْحَمْدُ لَا إِلَهَ إِلَّا الله الوَاحِدُ الفَرْدُ الصَّمَدُ الَّذِي لَمْ يَتَّخِذْ صَاحِبَةً وَلَا وَلَدًا وَلَمْ يَكُنْ لَهُ شَرِيْكٌ فِي الْمُلْكِ وَلَمْ يَكُنْ لَهُ وَلِيٌّ مِنَ الذُّلِّ وَكَبِّرْهُ تَكْبِيراً. اللَّهُمَّ إِنَّكَ قُلْتَ فِي كِتَابِكَ الْمُنَزَّلِ أُدْعُوْنِي أَسْتَجِبْ لَكُمْ دَعَوْنَاكَ رَبَّنَا فَاغْفِرْلَنَا كَمَا أَمَرْتَنَا إِنَّكَ لَا تُخْلِفُ الْمِيعَادَ. رَبَّنَا إِنَّنَا سَمِعْنَا مُنَادِيًا يُنَادِي لِلْإِيْمَانِ أَنْ آمِنُوا بِرَبِّكُمْ فَأَمَنَّا . رَبَّنَا فَاغْفِرْلَنَا ذُنُوبَنَا وَكَفِّرْ عَنَّا سَيِّئَاتِنَا وَتَوَفنَّا مَعَ الأَبْرَارِ. رَبَّنَا وَآتِنَا مَا وَعَدْتَنَا عَلَى رُسُلِكَ وَلاَ تُخْزِنَا يَوْمَ القِيَامَةِ إِنَّكَ لَا تُخْلِفُ الْمِيعَادِ. رَبَّنَا عَلَيْكَ تَوَكَّلْنَا وَإِلَيْكَ أَنَبْنَا وَإِلَيْكَ الْمَصِيرُ. رَبَّنَا اغْفِرْلَنَا ذُنُوبَنَا وَلإِخْوَانِنَا الَّذِيْنَ سَبَقُوْنَا بِالْإِيْمَانِ وَلَا تَجْعَلْ فِي قُلُوْبِنَا غِلاً لِلَّذِيْنَ آمَنُوْا رَبَّنَا إِنَّكَ رَءُوْفٌ رَحِيمٌ','Allah Maha Besar. Allah Maha Besar, Allah Maha Besar, hanya bagi Allah-lah segala pujian. Tidak ada tuhan selain Allah yang Maha Esa, Tunggal, dan tempat bergantung, tidak beristeri dan tidak beranak, tidak ada sekutu dalam kekuasaan, tidak menjadi pe- lindung kehinaan. Maka agungkanlah Dia dengan se- genap kebesaran. Ya Allah, sesungguhnya Engkau telah berfirman dalam Qur\'an-Mu: \"Berdoalah kepada-Ku niscaya akan Kuperkenankan bagimu\", sekarang kami berdoa kepada-Mu wahai Tuhan kami, maka ampunilah kami sebagaimana yang telah Engkau janjikan kepada kami, sesungguhnya Engkau tidak memungkiri janji. Ya Tuhan kami, sesungguhnya kami mendengar (seruan) yang menyeru kepada iman (yaitu): \"Berimanlah kamu kepada Tuhanmu\", maka kamipun beriman. Ya Tuhan kami ampunilah bagi kami dosa-dosa kami dan hapus- kanlah dari kami kesalahan-kesalahan kami, dan wafat- kanlah kami beserta orang-orang yang berbakti. Ya Tu- han kami, berilah kami apa yang telah Engkau janjikan kepada kami dengan perantaraan rasul-rasul Engkau. Dan janganlah Engkau hinakan kami di hari Kiamat. Sesungguhnya Engkau tidak menyalahi janji. Ya Allah, hanya kepada Engkaulah kami bertawakkal, dan hanya kepada Engkaulah tempat kembali. Wahai Tuhan kami, ampunilah dosa-dosa kami dan dosa semua saudara kami seiman yang telah mendahului kami dan janganlah Engkau jadikan kedengkian dalam kalbu kami terhadap mereka yang telah beriman, wahai Tuhan kami, sesung- guhnya Engkau Maha Pengasih dan Maha Penyayang.','prayers/default/audio/doa_sai/sai_putaran_2.mp3',NULL,1,1,32,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(33,NULL,'Doa Sa\'i Perjalanan Ketiga dari Bukit Shafa ke Marwah','Allaahu Akbar, Allaahu Akbar, Allaahu Akbar, wa lillaahil hamd. Rabbanaa atmim lanaa nuuranaa, waghfir lanaa, innaka \'alaa kulli syai-in qadiir. Allaahumma innii as- alukal khaira kullahu, \'aajilahu wa aajilahu, wa astaghfiruka li dzanbii, wa as\'aluka rahmataka yaa arhamar-raahimiin','اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ وَلِلَّهِ الْحَمْدُ. رَبَّنَا أَتْمِمْ لَنَا نُوْرَنَا وَاغْفِرْلَنَا إِنَّكَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. اللَّهُمَّ إِنِّي أَسْأَلُكَ الْخَيْرَ كُلَّهُ عَاجِلَهُ وَأَجِلَهُ وَاسْتَغْفِرُكَ لِذَنْبِي وَأَسْأَلُكَ رَحْمَتَكَ يَا أَرْحَمَ الرَّاحِمِينَ','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar, hanya bagi Allah segala pujian. Wahai Tuhan kami, sempurnakanlah cahaya terang bagi kami, sesungguhnya Engkau Maha Kuasa atas segala sesuatu. Ya Allah, sesungguhnya aku mohon pada-Mu segala kebaikan yang sekarang dan masa yang akan datang, dan aku mohon ampunan pada-Mu akan dosaku, serta aku mohon pada-Mu rahmat-Mu wahai Tuhan Yang Maha Pengasih dari segala yang pengasih.','prayers/default/audio/doa_sai/sai_putaran_3.mp3',NULL,1,1,33,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(34,NULL,'Doa Sa\'i Perjalanan Keempat dari Bukit Shafa ke Marwah','Allaahu Akbar, Allaahu Akbar, Allaahu Akbar, wa lillaahil hamd, Allaahumma innii as\'aluka min khairi maa ta\'lamu, wa a\'uudzubika min syarri maa ta\'lamu, wa astaghfiruka min kulli maa ta\'lamu, innaka anta \'allamul ghuyuub. Laa ilaaha illallahul malikul haqqul mubiin, Muhammadur-rasuulullahish- shaadiqul wa\'dil-amiin. Allaahumma innii as\'aluka kamaa hadaitanii lil-islaam an laa tanzi\'hu minnii hattaa tathawaffaanii wa ana muslim. Allaahummaj\'al fii qalbii nuuran wa fii sam\'ii nuuran, wa fii basharii nuura. Allahummasyrah lii shadrii wa yassir lii amrii, wa a\'uudzu bika min wasaawisisha- shadri wa syataatil-amri wa fitnatil-qabri. Allaahumma innii a\'uudzu bika min syarri maa yaliju fil-laili wa syarri maa yaliju fin- nahaari, wa min syarri maa tahubbu bihir- riyaahi yaa arhamar-raahimiin. Subhaanaka maa \'abadnaaka haqqa \'ibadaatika yaa Allah, subhaanaka maa dzakarnaaka haqqa dzikrika yaa Allah','اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ وَلِلَّهِ الْحَمْدُ اَللّٰهُمَّ إِنِّي أَسْأَلُكَ مِنْ خَيْرِ مَا تَعْلَمُ وَأَعُوْذُبِكَ مِنْ شَرِّ مَا تَعْلَمُ وَأَسْتَغْفِرُكَ مِنْ كُلِّ مَا تَعْلَمُ إِنَّكَ أَنْتَ عَلَّامُ الْغُيُوبِ. لَا إِلَهَ إِلَّا اللّٰهُ الْمُلْكُ الْحَقُّ الْمُبِينُ , مُحَمَّدٌ رَسُوْلُ اللّٰهِ صَادِقُ الْوَعْدِ الْأَمِينُ. اَللّٰهُمَّ إِنِّي أَسْأَلُكَ كَمَا هَدَيْتَنِي لِلْإِسْلَامِ أَنْ لَا تَنْزِعَهُ مِنِّي حَتَّى تَتَوَفَّنِي وَأَنَا مُسْلِمٌ ,اَللّٰهُمَّ اجْعَلْ فِي قَلْبِي نُوْرًا وَفِي سَمْعِي نُوْرًا وَفِي بَصَرِي نُوْرًا. اَللّٰهُمَّ اشْرَحْ لِي صَدْرِي وَيَسِّرْلِيْ أَمْرِي وَأَعُوْذُ بِكَ مِنْ وَسَاوِسِ الصَّدْرِ وَشَتَاتِ الْأَمْرِ وَفِتْنَةِ الْقَبْرِ. اَللّٰهُمَّ إِنِّي أَعُوْذُبِكَ مِنْ شَرِّ مَا يَلِجُ فِي اللَّيْلِ وَشَرِّ مَا يَلِجُ فِي النَّهَارِ وَمِنْ شَرِّ مَا تَهُبُّ بِهِ الرِّيَاحُ يَا أَرْحَمَ الرَّاحِمِينَ ,سُبْحَانَكَ مَا عَبَدْنَاكَ حَقَّ عِبَادَتِكَ يَا اللّٰهُ سُبْحَانَكَ مَا ذَكَرْنَاكَ حَقَّ ذِكْرِكَ يَا اللّٰه','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar, hanya bagi Allah segala pujian. Ya Allah, sesungguhnya aku mohon pada-Mu dari kebaikan yang Engkau tahu, dan aku berlindung pada-Mu dari kejahatan yang Engkau tahu, dan aku mohon ampun pada-Mu dari segala kesalahan yang Engkau ketahui, sesungguhnya Engkau Maha Mengetahui yang ghaib. Tidak ada Tuhan selain Allah, Maha Raja yang sebenar- benarnya. Muhammad utusan Allah yang selalu menepati janji lagi terpercaya. Ya Allah, sebagaimana Engkau telah menunjuki aku memilih Islam, maka aku mohon pada-Mu untuk tidak mencabutnya, sehingga aku meninggal sebagai seorang muslim. Ya Allah, berilah cahaya terang dalam hati, telinga dan penglihatanku. Ya Allah, lapangkanlah dadaku dan mudahkanlah bagiku segala urusanku. Dan aku berlindung pada-Mu dari kegundahan dada dan kekacauan urusan dan fitnah kubur. Ya Allah, aku berlindung pada-Mu dari kejahatan yang tersembunyi di waktu malam dan siang hari, serta kejahatan yang dibawa angin lalu, wahai Tuhan Yang Maha Pengasih dari segenap yang pengasih. Maha Suci Engkau, kami tidak bisa menyembah-Mu dengan pengabdian semestinya, ya Allah. Maha Suci Engkau, kami tidak bisa menyebut-Mu dengan semestinya, ya Allah.','prayers/default/audio/doa_sai/sai_putaran_4.mp3',NULL,1,1,34,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(35,NULL,'Doa Sa\'i Perjalanan Kelima dari Bukit Shafa ke Marwah','Allaahu Akbar Allaahu Akbar Allaahu Akbar wa lillaahil hamd. Subhaanaka maa syakarnaaka haqqa syukrika yaa Allah, subhaanaka maa a\'alaa sya\'naka yaa Allah. Allahumma habbib ilainal-iimaana wa zayyinhu fii quluubinaa, wa karrih ilainal- kufra wal-fusuuqa wal-\'ishyaan, waj\'alnaa minar-raasyidiin','اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ وَلِلَّهِ الْحَمْدُ سُبْحَانَكَ مَا شَكَرْنَاكَ حَقَّ شُكْرِكَ يَا اللّٰهُ سُبْحَانَكَ مَا أَعْلَى شَأْنَكَ يَا اَللّٰهُ ,اَللَّهُمَّ حَبِّبْ إِلَيْنَا الْإِيْمَانَ وَزَيِّنْهُ فِي قلُوْبِنَا وَكَرِّهْ إِلَيْنَا الْكُفْرَ وَالْفُسُوْقَ وَالْعِصْيَانَ وَاجْعَلْنَا مِنَ الرَّاشِدِيْنَ','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar, dan hanya bagi Allah segala pujian. Maha Suci Engkau, kami tidak mensyukuri-Mu dengan syukur yang semestinya, ya Allah. Maha Suci Engkau, alangkah Agung Zat-Mu, ya Allah. Ya Allah, cintakanlah kami kepada iman dan hiaskanlah di hati kami. Tanamkan kebencian bagi kami kepada perbuatan kufur, fasiq dan durhaka. Jadikanlah kami dari golongan orang-orang yang mendapat petunjuk.','prayers/default/audio/doa_sai/sai_putaran_5.mp3',NULL,1,1,35,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(36,NULL,'Doa Sa\'i Perjalanan Keenam dari Marwah ke Bukit Shafa','Allaahu akbar, Allaahu akbar, Allaahu akbar, wa lillaahil hamd, laa ilaaha illallaahu wahdahu, shadaqa wa\'dahu, wanashara \'abdahu, wahazamal ahzaaba wahdahu, laa ilaaha illallaahu walaa na\'budu illaa iyyaahu, mukhlishiina lahud- diina walau karihal kaafiruun. Allaahumma innii as-alukal hudaa wat- tuqaa wal-\'afaafa wal-ghinaa. Allaahumma lakal hamdu kalladzii naquulu wa khairan mimmaa naquulu. Allaahumma innii as-aluka ridhaaka wal jannata, wa a\'uudzu bika min sakhathika wan-naari, wamaa yuqarribunii ilaihaa min qaulin au fi\'lin au \'amalin. Allaahumma binuurikahtadainaa wabi- fadhlikastaghnainaa wafii kanafika wa- in\'aamika wa \'athaa-ika wa ihsaanika ashbahnaa wa amsainaa antal awwalu falaa qablaka syai-un wal-aakhiru falaa ba\'daka syai-un wazh-zhaahiru falaa syai-a fauqaka wal baathinu falaa syai-a duunaka na\'uudzu bika minal falasi wal kasali wa \'adzaabal qabri wa fitnatil ghinaa wanas- alukal fauza bil-jannah','اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ وَلِلّٰهِ الْحَمْدُ لَا إِلَهَ إِلَّا اللّٰهُ وَحْدَهُ صَدَقَ وَعْدَهُ وَنَصَرَ عَبْدَهُ وَهَزَمَ الْأَحْزَابَ وَحْدَهُ لَا إِلَهَ إِلَّا اللّٰهُ وَلَا نَعْبُدُ إِلَّا إِيَّاهُ مُخْلِصِينَ لَهُ الدِّيْنَ وَلَوْ كَرِهَ الْكَافِرُوْنَ. اَللّٰهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى اَللّٰهُمَّ لَكَ الْحَمْدُ كَالَّذِي نَقُوْلُ وَخَيْرًا مِمَّا نَقُوْلُ اَللّٰهُمَّ إِنِّي أَسْأَلُكَ رِضَاكَ وَالْجَنَّةَ وَأَعُوْذُبِكَ مِنْ سَخَطِكَ وَالنَّارِ وَمَا يُقَرِّبُنِي إِلَيْهَا مِنْ قَوْلٍ أَوْ فِعْلٍ أَوْ عَمَلٍ. اَللّٰهُمَّ بِنُوْرِكَ اهْتَدَيْنَا وَبِفَضْلِكَ اسْتَغْنَيْنَا وَفِي كَنَفِكَ وَإِنْعَامِكَ وَعَطَائِكَ وَإِحْسَانِكَ أَصْبَحْنَا وَأَمْسَيْنَا أَنْتَ الْأَوَّلُ فَلَا قَبْلَكَ شَيْءٌ وَالْآخِرُ فَلَا بَعْدَكَ شَيْءٌ وَالظَّاهِرُ فَلَا شَيْئً فَوْقَكَ وَالْبَاطِنُ فَلَا شَيْئَ دُوْنَكَ نَعُوْذُبِكَ مِنَ الْفَلَسِ أَوِ الْكَسَلِ وَعَذَابِ الْقَبْرِ وَفِتْنَةِ الْغِنَى وَنَسْأَلُكَ الْفَوْزَ بِالْجَنَّةِ','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar. Segala puji hanya untuk Allah. Tidak ada Tuhan selain Allah Yang Maha Esa, yang menepati janji- Nya, menolong hamba-Nya dan mengalahkan sendiri musuh-musuh-Nya. Tiada Tuhan selain Allah. Dan kami tidak menyembah selain Dia dengan memurnikan kepatuhan kepada-Nya, sekalipun orang-orang kafir membenci. Ya Allah, aku memohon pada-Mu petunjuk, ketakwaan, pengendalian diri dan kekayaan. Ya Allah, pada-Mu-lah segala puji seperti yang kami ucapkan. Ya Allah, aku mohon pada-Mu ridha-Mu dan surga, aku berlindung pada-Mu dari murka-Mu dan siksa neraka dan apapun yang mendekatkan aku padanya (neraka), baik ucapan ataupun amal perbuatan. Ya Allah, hanya dengan nur cahaya-Mu kami ini mendapat petunjuk, dengan pemberian-Mu kami merasa cukup, dan dalam naungan-Mu, nikmat-Mu, anugerah-Mu dan kebajikan- Mu jualah kami ini berada di waktu pagi dan petang. Engkau-lah yang mula pertama, tidak ada sesuatu pun yang ada sebelum-Mu dan Engkau pulalah yang paling akhir dan tidak ada sesuatu pun yang ada di belakang (sesudah)-Mu, Engkaulah yang lahir (nyata), maka tidak ada sesuatu pun yang di atas Engkau. Engkau pulalah yang batin, maka tidak ada sesuatupun di bawah-Mu. Kami berlindung pada-Mu dari pailit, malas, siksa kubur dan fitnah kekayaan serta kami mohon pada-Mu kemenangan memperoleh surga.','prayers/default/audio/doa_sai/sai_putaran_6.mp3',NULL,1,1,36,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(37,NULL,'Doa Sa\'i Perjalanan Ketujuh dari Bukit Shafa ke Marwah','Allaahu akbar, Allaahu akbar, Allaahu akbar kabiiran walhamdu lillaahi katsiiraa. Allaahumma habbib ilayyal iimaana wa zayyinhu fii qalbii wa karrih ilayyal kufra wal fusuuqa wal-\'ishyaana waj\'alnii minar-raasyidiin','اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ كَبِيرًا وَالْحَمْدُ لِلَّهِ كَثِيرًا. اَللّٰهُمَّ حَبِّبْ إِلَيَّ الْإِيْمَانَ وَزَيِّنْهُ فِي قَلْبِي وَكَرِّهْ إِلَيَّ الْكُفْرَ وَالْفُسُوْقَ وَالْعِصْيَانَ وَاجْعَلْنِي مِنَ الرَّاشِدِينَ','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar. Segala puji bagi Allah dengan pujian yang tidak terhingga. Ya Allah, cintakanlah aku kepada iman dan hiaskanlah ia di kalbuku. Tanamkanlah kebencian padaku perbuatan kufur, fasiq dan durhaka. Dan jadikanlah pula aku dari golongan orang yang mendapat petunjuk.','prayers/default/audio/doa_sai/sai_putaran_7.mp3',NULL,1,1,37,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(38,NULL,'Pilar Hijau','Rabbighfir, warham, wa\'fu, wa takarram, wa tajaawaz, \'ammaa ta\'lamu, innaka ta\'lamu, maa laa na\'lamu, innaka antallaahu al a’azzul akram','رَبِّ اغْفِرْ وَارْحَمْ وَاعْفُ وَتَكَرَّمْ وَتَجَاوَزْ عَمَّا تَعْلَمُ إِنَّكَ تَعْلَمُ مَا لَا نَعْلَمُ إِنَّكَ أَنْتَ اللّٰهُ الْأَعَزُّ الْأَكْرَمُ','Ya Allah ampunilah, sayangilah, maafkanlah, bermurah hatilah dan hapuskanlah apa-apa yang Engkau ketahui. Sesungguhnya Engkau Maha Mengetahui apa- apa yang kami sendiri tidak tahu. Sesungguhnya Engkau ya Allah Maha Mulia dan Maha Pemurah.','prayers/default/audio/doa_sai/pilar_hijau.mp3',NULL,1,1,38,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(39,NULL,'Doa Ketika mendekati bukit Shafa dan Marwah','Innash shafaa wal-marwata min sya\'aa- irillaahi, faman hajjal baita awi\'tamara falaa junaaha \'alaihi an yaththawwafa bihimaa wa man tathawwa\'a khairan fa- innallaaha syaakirun \'aliim.','إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَائِرِ اللّٰهِ. فَمَنْ حَجَّ الْبَيْتَ أَوِعْتَمَرَ فَلَا جُنَاحَ عَلَيْهِ أَنْ يَطَوَّفَ بِهِمَا وَمَنْ تَطَوَّعَ خَيْرًا فَإِنَّ اللّٰهَ شَاكِرٌ عَلِيْمٌ','Sesungguhnya Shafa dan Marwah sebagian dari syiar-syiar (tanda kebesaran) Allah. Maka barangsiapa yang beribadah haji ke Baitullah ataupun berumrah, maka tidak ada dosa baginya berkeliling (mengerjakan sa\'i antara keduanya). Dan barangsiapa mengerjakan sesuatu kebajikan dengan kerelaan hati, maka sesungguhnya Allah Maha Menerima Kebaikan lagi Maha Mengetahui.','prayers/default/audio/doa_sai/sofa_marwah.mp3',NULL,1,1,39,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(40,NULL,'Doa Di Bukit Marwah Selesai Sa\'i','Allaahumma rabbanaa taqabbal minnaa wa \'aafinaa, wa\'fu \'annaa, wa \'alaa thaa\'atika wasyukrika a\'innaa wa \'alaa ghairika laa takilnaa, wa \'alal iimaani wal- islaamil kaamili jamii\'an thawaffanaa, wa anta raadhin \'annaa. Allaahummarhamnii bitarkil ma\'aashii \'abadan maa abqaitanii warhamnii an atakallafa maa laa ya\'niinii warzuqnii husnun-nazhari fiimaa yurdhiika \'annii yaa arhamar raahimiin.','اَللّٰهُمَّ رَبَّنَا تَقَبَّلْ مِنَّا وَعَافِنَا وَاعْفُ عَنَّا وَعَلَى طَاعَتِكَ وَشُكْرِكَ أَعِنَّا وَعَلَى غَيْرِكَ لَا تَكِلْنَا وَعَلَى الْإِيْمَانِ وَالْإِسْلَامِ الْكَامِلِ جَمِيعًا تَوَفَّنَا وَأَنْتَ رَاضٍ عَنَّا اَللّٰهُمَّ ارْحَمْنِي بِتَرْكِ الْمَعَاصِي أَبَدًا مَا أَبْقَيْتَنِي وَارْحَمْنِيْ أَنْ تَكَلَّفَ مَا لَا يَعْنِينِي وَارْزُقْنِي حُسْنَ النَّظَرِ فِيمَا يُرْضِيْكَ عَنِّي يَا أَرْحَمَ الرَّاحِمِينَ','Ya Allah ya Tuhan kami, terimalah amalan kami, berilah perlindungan kepada kami, maafkanlah kesalahan kami dan berilah pertolongan kepada kami untuk taat dan bersyukur kepada-Mu. Janganlah Engkau jadikan kami bergantung selain kepada-Mu. Matikanlah kami dalam iman dan Islam secara sempurna dalam keridhaan-Mu. Ya Allah rahmatilah kami sehingga mampu meninggalkan segala kejahatan selama hidup kami, dan rahmatilah kami sehingga tidak berbuat hal yang tidak berguna. Karuniakanlah kepada kami sikap pandang yang baik terhadap apa-apa yang membuat-Mu ridha terhadap kami. Wahai Tuhan Yang Maha Pengasih dari segala yang pengasih.',NULL,NULL,1,1,40,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(41,NULL,'Doa Menggunting Rambut','Allaahu akbar Allaahu akbar Allaahu akbar. Alhamdu lillaahi \'alaa maa hadaanaa walhamdu lillaahi \'alaa maa an\'amanaa bihi \'alainaa. Allaahumma haadzihi naashibatii fataqabbal minnii waghfir dzunuubii. Allaahummaghfir lil muhalliqiina wal maqshuuriina yaa waasi\'al maghfirah. Allaahummatsbut lii bikulli sya\'ratin wa hasanatan wamhu \'annii bihaa sayyi-atan. Warfa\' lii bihaa indaka darajah','اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ. اَلْحَمْدُ لِلَّهِ عَلَى مَا هَدَانَا وَالْحَمْدُ لِلَّهِ عَلَى مَا أَنْعَمَنَا بِهِ عَلَيْنَا اَللّٰهُمَّ هٰذِهِ نَاصِيَتِي فَتَقَبَّلْ مِنِّي وَاغْفِرْ ذُنُوْبِي. اَللّٰهُمَّ اغْفِرْ لِلْمُحَلِّقِينَ وَالْمَقْصُورِيْنَ يَا وَاسِعَ الْمَغْفِرَةِ. اَللّٰهُمَّ اُثْبُتْ لِي بِكُلِّ شَعْرَةٍ حَسَنَةً وَامْحُ عَنِّي بِهَا سَيِّئَةً, وَارْفَعْ لِيْ بِهَا عِنْدَكَ دَرَجَةً','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar. Segala puji bagi Allah yang telah memberi petunjuk kepada kita dan segala puji bagi Allah tentang apa-apa yang telah Allah karuniakan kepada kami. Ya Allah, ini ubun-ubunku, maka terimalah dariku (amal perbuatanku) dan ampunilah dosa-dosaku. Ya Allah, ampunilah orang-orang yang mencukur dan memendekkan rambutnya wahai Tuhan yang Maha Luas ampunan-Nya. Ya Allah, tetapkanlah untuk diriku setiap helai rambut kebajikan dan hapuskanlah untukku dengan setiap helai rambut kejelekan. Dan angkatlah derajatku di sisi-Mu',NULL,NULL,1,1,41,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(42,NULL,'Doa Setelah Menggunting Rambut','Alhamdu lillaahil ladzii qadhaa \'annaa ma- naasikanaa. Allaahumma zidnaa iimaanan wa yaqiinan wa \'aunan waghfir lanaa wa liwaalidainaa walisaa-iril muslimiina wal muslimaat.','الْحَمْدُ لِلَّهِ الَّذِي قَضَى عَنَّا مَنَاسِكَنَا اللَّهُمَّ زِدْنَا إِيْمَانًا وَيَقِينًا وَعَوْنًا وَاغْفِرْ لَنَا وَلِوَالِدَيْنَ وَلِسَائِرِ الْمُسْلِمِينَ وَالْمُسْلِمَاتِ','Segala puji bagi Allah yang telah menyelesaikan manasik kami. Ya Allah tambahkanlah kepada kami iman, keyakinan, pertolongan dan ampunilah kami, kedua orang tua kami serta seluruh kaum muslimin dan muslimat.',NULL,NULL,1,1,42,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(43,NULL,'Doa Ketika Berangkat ke Arafah','Allahumma ilaika tawajjahtu wa ilaa wajhikal karim aradtu faj’al dzanbi maghfuuran, wajji mambruuran, warhamni wala tukhayyibni innaka ala kulli syaiin qadir.','اللّهُمَّ إِلَيْكَ تَوَجَّهْتُ وَإِلَى وَجْهِكَ الْكَرِيْمِ اَرَدْتُ فَاجْعَلْ ذَنْبِيْ مَغْفُوْرًا وَحَجِّيْ مَبْرُوْرًا وَارْحَمْنِيْ وَلاَ تُخَيِّبْنِيْ إِنَّكَ عَلَى كُلِّ شَيْءٍ قَدِيْرٌ','Ya Allah, hanya kepada-Mu aku menghadap dan terhadapmu-Mu Tuhan Yang Pemurah aku mengharap, maka jadikan dosaku terampuni, hajiku diterima, sayangilah aku dan jangan permalukan. Sungguh Engkau Maha Kuasa atas segala sesuatu.',NULL,NULL,1,1,43,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(44,NULL,'Doa ketika Masuk Arafah','Allahumma ilaika tawajjahtu, wabika’tashamtu, wa’alaika tawakkaltu. Allahummaj’alniiy mimmantubaahiiy bihilyauma malaa ikataka, innaka ‘alaa kulla sya’in qadiirun','اللَّهُمَّ إِلَيْكَ تَوَجَّهْتُ، وَبِكَ اعْتَصَمْتُ، وَعَلَيْكَ تَوَكَّلْتُ . اللَّهُمَّ اجْعَلْنِيْ مِمَّنْ تُبَاهِيْ بِهِ اليَوْمَ مَلاَئِكَتَكَ، إِنَّكَ عَلَى كُلِّ شَيْءٍ قَدِيْرٌ','Ya Allah, hanya kepada Engkaulah aku menghadap, dengan Engkaulah aku berpegang teguh, pada Engkaulah aku berserah diri. Ya Allah, jadikanlah aku di antara orang yang hari ini Engkau banggakan di hadapan Malaikat-Mu, sesungguhnya Engkau Maha Kuasa atas segala sesuatu.',NULL,NULL,1,1,44,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(45,NULL,'Doa dan Dzikir Wukuf di Arafah','Laa ilaaha illallaah wahdahu laa syariika lah lahul mulku wa lahul hamdu yuhyii wa yumiitu wa huwa \'ala kulli syai-in qadiir','لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ يُحْيِي وَيُمِيْتُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ','Tidak ada Tuhan selain Allah, Zat yang Esa dan tidak ada sekutu bagi-Nya. Bagi-Nya segala kerajaan dan segala pujian. Di tangan-Nya-lah segala kebaikan dan Dia Mahakuasa atas segala sesuatu.',NULL,NULL,1,1,45,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(46,NULL,'Doa ketika Sampai di Muzdalifah','Allaahumma inna hadzihi muzdalifatu jumi\'at fiihaa alsinatun mukhtalifatun, tas aluka hawaa ija mutanawwi \'atan faj\'alnii mimman da\'aaka fastajabta lahu watawakkala \'alaika fakafaitahu yaa arhamarraahimiin.','اَللّٰهُمَّ إِنَّ هٰذِهِ مُزْدَلِفَةُ جُمِعَتْ فِيْهَا أَلْسِنَةٌ مُخْتَلِفَةٌ تَسْأَلُكَ حَوَائِجَ مُتَنَوِّعَةً فَاجْعَلْنِيْ مِمَّنْ دَعَاكَ فَاسْتَجَبْتَ لَهُ وَتَوَكَّلَ عَلَيْكَ فَكَفَيْتَهُ يَا أَرْحَمَ الرَّاحِمِيْنَ','Ya Allah, sesungguhnya ini Muzdalifah telah berkumpul bermacam-macam bahasa yang memohon kepada-Mu keperluan yang beraneka ragam, maka masukkanlah aku ke dalam golongan orang yang memohon kepada-Mu, lalu Engkau penuhi permintaannya, yang berserah diri pada-Mu, lalu Engkau lindungi dia, wahai Tuhan Yang Maha Pengasih.',NULL,NULL,1,1,46,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(47,NULL,'Doa ketika Sampai di Muzdalifah Versi Imam an-Nawawi','Allaahumma innii as-aluka an tarzuqanii fii haadzal makaani jawaami\'al khairi kullihii, wa anttushliha sya\'nii kullahu wa antashrifa \'annisy-syarra kullahu, fa innahu laa yafʼalu dzaalika ghairuka, walaa yajuudu bihi illaa anta','اَللّٰهُمَّ إِنِّي أَسْأَلُكَ أَنْ تَرْزُقَنِي فِي هٰذَا الْمَكَانِ جَوامِعَ الْخَيْرِ كُلِّهِ وَأَنْ تُصْلِحَ شَأْنِيْ كُلَّهُ, وَأَنْ تَصْرِفَ عَنِّي الشَّرَّ كُلَّهُ فَإِنَّهُ لَا يَفْعَلُ ذَلِكَ غَيْرُكَ وَلَا يَجُودُ بِهِ إِلَّا أَنْتَ','Ya Allah, sungguh aku memohon kepada-Mu, supaya Engkau menganugerahkan rezeki kepadaku dalam tempat ini berupa segala ben- tuk kebaikan supaya Engkau memperbaiki keadaanku seluruhnya dan menghilangkan dariku segala bentuk keburukan, karena tidak ada yang mampu melakukan selain Engkau dan tidak ada yang dapat memberikan-nya selain Engkau.',NULL,NULL,1,1,47,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(48,NULL,'Doa ketika Sampai di Mina','Allahumma haadzihi minaa famnun \'alayya bimaaa mananta bihi \'ala auliyaa-ika wa ahli thaa-atika','اللَّهُمَّ هٰذِهِ مِنٰي فَامْنُنْ عَلَيَّ بِمَا مَنَنْتَ بِهِ عَلَى أَوْلِيَائِكَ وَأهْلِ طَاعَتِكَ','Ya Allah, tempat ini adalah Mina, maka anugerahilah aku apa yang telah Engkau anugerahkan kepada orang-orang yang dekat dan taat kepada-Mu.',NULL,NULL,1,1,48,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(49,NULL,'Doa ketika Sampai di Mina Versi Imam an-Nawawi','Alhamdulillaahilladzii balaghaniihaa saaliman mu’aafan Allaahumma haadzihi minaa qad ataituhaa wa anaa ‘abduka wafii qabdhatika as-aluka an-tamunna ‘alayya bimaa mananta bihi ‘alaa auliyaaika Allaahumma innii a’uudzubika minalhirmaani walmushiibati fii diinii yaa arhamarraahimiin.','اَلْحَمْدُ لِلّٰهِ الَّذِي بَلَغَنِيْهَا سَالِمًا مُعَافًا, اَللّٰهُمَّ هٰذِهِ مِنٰى قَدْ أَتَيْتُهَا, وَأَنَا عَبْدُكَ, وَفِي قَبْضَتِكَ أَسْأَلُكَ أَنْ تَمُنَّ عَلَيَّ بِمَا مَنَنْتَ بِهِ عَلَى أَوْلِيَائِكَ, اَللّٰهُمَّ إِنِّي أَعُوْذُ بِكَ مِنَ الْحِرْمَانِ وَالْمُصِيْبَةِ فِي دِيْنِي يَا أَرْحَمَ الرَّاحِمِيْنَ','Segala puji bagi Allah yang telah menyampaikan aku ke sini (Mina) dengan selamat dan sehat. Ya Allah, inilah tempat bernama Mina, aku datang ke tempat ini sedang aku adalah hamba-Mu dan dalam genggaman-Mu. Aku memohon kepada-Mu, berilah aku nikmat sebagaimana nikmat yang Engkau berikan kepada kekasih-kekasih-Mu. Ya Allah, aku berlindung kepada-Mu dari terhalang rahmat-Mu dan dari musibah pada agamaku, ya Allah, Yang Maha Pengasih dari segala Yang Pengasih',NULL,NULL,1,1,49,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(50,NULL,'Doa Melontar Jamrah','Bismillaahi Allaahu Akbar rajman lissyayaathiina waridhan lirrahmaani Allaahummaj’al hajjan mab- ruuraa wasa’yan masykuura','بِسْمِ اللّٰهِ اَللّٰهُ أَكْبَرُ رَجْمًا لِلشَّيَاطِينِ وَرِضًا لِلرَّحْمٰنِ. اَللّٰهُمَّ اجْعَلْ حَجًّا مَبْرُوْرًا وَسَعْيًا مَشْكُورًا','Dengan nama Allah, Allah Maha Besar, kutukan bagi segala setan dan rida bagi Allah Yang Maha Pengasih, Ya Allah Tuhanku, jadikanlah ibadah hajiku ini haji yang mabrur dan sa \'i yang diterima',NULL,NULL,1,1,50,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(51,NULL,'Doa Setelah Melempar Jumrah','Alhamdulillaahi hamdan kastiiran thayyiban mubaarakan fiih. Allaahumma laa uhshii tsanaa an ‘alaika anta kamaa atsnaita ‘alaa nafsika. Allaahumma ilaika afadhtu wa min ‘adzaabika asyfaqtu wa ilaika raghibtu waminka rahibtu faqbal nusukii wa a’dzhim ajrii warham tadharru’ii waqbal taubatii wa aqilla  ‘atsratii wastajib da’watii wa a’thinii su’lii. Allaahumma robbanaa taqabbal minnaa walaa taj’alnaa minal mujrimiina wa adkhilnaa fii ‘ibaadikashaalihiina ya arhamarraahimiina','اَلْحَمْدُ لِلَّهِ حَمْدًا كَثِيرًا طَيِّبًا مُبَارَكًا فِيْهِ . اَللّٰهُمَّ لَا أُحْصِي ثَنَاءً عَلَيْكَ أَنْتَ كَمَا أَثْنَيْتَ عَلَى نَفْسِكَ. اَللّٰهُمَّ إِلَيْكَ أَفَضْتُ وَمِنْ عَذَابِكَ أَشْفَقْتُ وَإِلَيْكَ رَغِبْتُ وَمِنْكَ رَهِبْتُ فَاقْبَلْ نُسُكِي وَأَعْظِمْ أَجْرِي وَارْحَمْ تَضَرُّعِي وَاقْبَلْ تَوْبَتِي وَأَقِلَّ عَثْرَتِي وَاسْتَجِبْ دَعْوَتِي وَأَعْطِنِي سُؤْلِي. اَللّٰهُمَّ رَبَّنَا تَقَبَّلْ مِنَّا وَلَا تَجْعَلْنَا مِنَ الْمُجْرِمِينَ, وَأَدْخِلْنَا فِي عِبَادِكَ الصَّالِحِينَ يَا أَرْحَمَ الرَّاحِمِينَ','Segala puji bagi Allah, pujian yang banyak lagi baik dan membawa berkat di dalamnya. Ya Allah, sekali-kali kami tidak mampu men- cakup (segala macam) pujian untuk-Mu, sesuai pujianMu atas diri-Mu. Ya Allah, ha- nya kepada-Mu aku berserah, dari siksa-Mu aku mohon belas kasihan, dan kepada-Mu lah aku berharap dan aku takut, maka teri- malah ibadahku, perbesarlah pahalaku, kasi- hanilah kerendahan hatiku, terimalah tau- batku, perkecillah kekeliruanku perkenan- kanlah permohonanku dan berikanlah per- mintaanku. Ya Allah kabulkanlah, terimalah persembahan kami ini dan janganlah kami dijadikan orang-orang yang berdosa, tetapi masukkanlah kami dalam hamba-Mu yang saleh wahai Tuhan Yang Paling Pengasih.',NULL,NULL,1,1,51,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(52,NULL,'Doa Masuk Kota Madinah','Allâhumma hâdzâ haramu rasûlika, faj\'alhu li wiqâyatan minan nâri, wa amanan minal adzabi wa súil hisabi','اَللَّهُمَّ هٰذَا حَرَمُ رَسُولِكَ. فَاجْعَلْهُ وِقَايَةً لِي مِنَ النَّارِ وَأَمَانَةً مِنَ الْعَذَابِ وَسُوءِ الْحِسَابِ','Ya Allah ini adalah tempat suci Rasul-Mu. Tolong jadikan ia sebagai pelindungku dari jilatan api neraka dan sebagai pengaman dari siksa hisab yang buruk',NULL,NULL,1,1,52,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(53,NULL,'Doa Masuk Masjid Nabawi','A\'udzu billahil-\'azhimi wa bi wajhihil-karimi wa sulthanihil-qadimi min asy-syaithani ar-rajimi, bismillahi Allahumma shalli \'ala Muhammadin wa alihi wa sallim. Allahumma igfir li dzunubi wa-ftah li abwaba rahmatika','أَعُوْذُ بِا للّٰهِ الْعَظِيْمِ وَبِوَجْهِهِ الْكَرِيْمِ وَسُلْطَانِهِ الْقَدِيْمِ مِنَ الشَّيْطَانِ الرَّجِيْمِ. بِسْمِ للّٰهِ وَالْحَمْدُ لِلهِ. أَللّٰهُمَّ صَلِّ وَسَلِّمْ عَلَى سَيِّدِنَا مُحَمَّدٍ وَعَلَى آلِ سَيِّدِنَا مُحَمَّدٍ. اَللَّهُمَّ اغْفِرْ لِي ذُنُوْبِي وَافْتَحْ لِي أَبْوَابَ رَحْمَتِكَ','Hamba berlindung kepada Allah yang Maha Agung, kepada wajah-Nya yang Mulia, dan kepada kekuasaan-Nya yang Mahadahulu, dari setan yang terkutuk. Dengan menyebut nama Allah; ya Allah, curahkanlah shalawat dan salam kepada Muhammad beserta keluarga Beliau. Ya Allah, ampunilah dosa-dosa hamba dan bukakanlah pintu-pintu rahmat-Mu untuk hamba',NULL,NULL,1,1,53,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(54,NULL,'Doa Sebelum Makan','Allahumma baarik lanaa fiimaa razaqtanaa wa qinaa \'adzaaban naar.','اللَّهُمَّ بَارِكْ لَنَا فِيمَا رَزَقْتَنَا وَقِنَا عَذَابَ النَّارِ','Ya Allah, berkahilah kami atas rezeki yang telah Engkau anugerahkan kepada kami dan peliharalah kami dari siksa neraka.',NULL,NULL,1,1,54,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(55,NULL,'Doa Setelah Makan','Alhamdu lillahil ladzii ath\'amanaa wa saqaanaa wa ja\'alanaa muslimiin.','الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ','Segala puji bagi Allah yang telah memberi kami makan dan minum serta menjadikan kami termasuk golongan orang-orang muslim.',NULL,NULL,1,1,55,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(56,NULL,'Doa Naik Kendaraan','Subhaanalladzii sakhkhara lanaa haadzaa wa maa kunnaa lahu muqriniina wa innaa ilaa rabbinaa lamunqalibuun.','سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ','Maha Suci Allah yang telah menundukkan semua ini bagi kami padahal kami sebelumnya tidak mampu menguasainya, dan sesungguhnya kami akan kembali kepada Tuhan kami.','prayers/default/doa_naik_kendaraan.mp3',NULL,1,1,56,'2026-10-01 02:14:09','2026-10-01 02:14:09');
/*!40000 ALTER TABLE `doa` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doa_has_kategori`
--

DROP TABLE IF EXISTS `doa_has_kategori`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `doa_has_kategori` (
  `id_doa` bigint(20) unsigned NOT NULL,
  `id_kategori` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id_doa`,`id_kategori`),
  KEY `doa_has_kategori_id_kategori_foreign` (`id_kategori`),
  CONSTRAINT `doa_has_kategori_id_doa_foreign` FOREIGN KEY (`id_doa`) REFERENCES `doa` (`id_doa`) ON DELETE CASCADE,
  CONSTRAINT `doa_has_kategori_id_kategori_foreign` FOREIGN KEY (`id_kategori`) REFERENCES `doa_kategori` (`id_kategori`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doa_has_kategori`
--

LOCK TABLES `doa_has_kategori` WRITE;
/*!40000 ALTER TABLE `doa_has_kategori` DISABLE KEYS */;
INSERT INTO `doa_has_kategori` VALUES (6,1),(6,2),(7,1),(7,2),(8,3),(9,3),(10,3),(11,3),(12,1),(12,2),(12,3),(13,1),(13,2),(13,3),(14,1),(14,2),(14,3),(15,1),(15,2),(15,3),(16,1),(16,2),(16,3),(17,1),(17,2),(17,3),(18,1),(18,2),(18,3),(19,1),(19,3),(20,2),(20,3),(20,4),(21,2),(21,3),(21,4),(22,2),(22,3),(22,4),(23,2),(23,3),(23,4),(24,2),(24,3),(24,4),(25,2),(25,3),(25,4),(26,2),(26,3),(26,4),(27,2),(27,3),(27,4),(28,1),(28,2),(29,1),(29,2),(29,3),(29,5),(30,1),(30,2),(30,3),(30,5),(31,1),(31,2),(31,3),(31,5),(32,1),(32,2),(32,3),(32,5),(33,1),(33,2),(33,3),(33,5),(34,1),(34,2),(34,3),(34,5),(35,1),(35,2),(35,3),(35,5),(36,1),(36,2),(36,3),(36,5),(37,1),(37,2),(37,3),(37,5),(38,1),(38,2),(38,3),(38,5),(39,1),(39,2),(39,3),(39,5),(40,1),(40,2),(40,3),(40,5),(41,1),(41,2),(41,3),(42,1),(42,2),(42,3),(43,3),(44,3),(45,3),(46,3),(47,3),(48,3),(49,3),(50,3),(51,3),(52,1),(52,2),(52,3),(53,1),(53,2),(53,3),(56,6);
/*!40000 ALTER TABLE `doa_has_kategori` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doa_item`
--

DROP TABLE IF EXISTS `doa_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `doa_item` (
  `id_doa_item` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_doa` bigint(20) unsigned NOT NULL,
  `nama` varchar(255) DEFAULT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `text_arab` longtext DEFAULT NULL,
  `text_latin` longtext DEFAULT NULL,
  `text_indonesia` longtext DEFAULT NULL,
  `subtitle_start_ms` int(10) unsigned DEFAULT NULL,
  `subtitle_end_ms` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_doa_item`),
  KEY `doa_item_id_doa_foreign` (`id_doa`),
  CONSTRAINT `doa_item_id_doa_foreign` FOREIGN KEY (`id_doa`) REFERENCES `doa` (`id_doa`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doa_item`
--

LOCK TABLES `doa_item` WRITE;
/*!40000 ALTER TABLE `doa_item` DISABLE KEYS */;
INSERT INTO `doa_item` VALUES (1,1,'',1,'بِسْمِ اللّٰهِ تَوَكَّلْتُ عَلَى اللّٰهِ لَاحَوْلَ وَلَا قُوَّةَ الَّا بِاللّٰه','Bismillahi tawakkaltu \'alallah, laa hawla wa laa quwwata illa billah','Dengan nama Allah aku bertawakal kepada Allah tiada daya untuk memperoleh manfaat dan tiada pula kuasa untuk menolak mudarat melainkan dengan pertolongan Allah. (HR Abu Daud dan Tirmizi)',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(2,2,'',1,'بِسْمِ اللّٰهِ الْمَالِكِ الرَّحْمٰنِ. وَمَا قَدَرُوا اللّٰهَ حَقَّ قَدْرِهِ وَالْأَرْضُ جَمِيعًا قَبْضَتُهُ يَوْمَ الْقِيَامَةِ وَالسَّمٰوَاتُ مَطْوِيّٰتٌ بِيَمِيْنِهِ سُبْحَانَهُ وَتَعَالَي عَمَّا يُشْرِكُوْنَ . بِسْمِ اللّٰهِ مَجْرٰيهَا وَمُرْسٰهَا إِنَّ رَبِّي لَغَفُورٌ رَّحِيمٌ','Bismillahil malikirrahman. Wa mā qadarullāha ḥaqqa qadrihī wal-arḍu jamī\'ang qabḍatuhụ yaumal-qiyāmati was-samāwātu maṭwiyyātum biyamīnih, sub-ḥānahụ wa ta\'ālā \'ammā yusyrikụn. Bismillahi majreha wa mursaha inna rabbi la ghofurur rohim.','Dengan nama Allah Yang Maha Penguasa lagi Maha Pengasih. Tiada mengagungkan Allah sebagaimana mestinya, padahal bumi seluruhnya dalam genggaman-Nya pada hari kiamat dan langit digulung dengan kekuasaan-Nya. Maha Suci dan Maha Tinggi Dia dari apa yang mereka persekutukan. Dengan Nama Allah di waktu berangkat dan berlabuh. Sesungguhnya Tuhanku benar-benar Maha Pengampun lagi Maha Penyayang.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(3,3,'',1,'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ.  اَللّٰهُ أَكْبَرُ. اَللّٰهُ أَكْبَرُ. اَللّٰهُ أَكْبَرُ. سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ. اللّٰهُمَّ إِنَّا نَسْأَلُكَ فِي سَفَرِنَا هٰذَا الْبِرَّ وَالتَّقْوٰى وَمِنَ الْعَمَلِ مَا تَرْضٰى. اَللّٰهُمَّ هَوِّنْ عَلَيْنَا سَفَرَنَا هَذَا وَأَطْوِ عَنَّا بُعْدَهُ. اَللّٰهُمَّ أَنْتَ الصَّاحِبُ فِي السَّفَرِ. وَالْخَلِيفَةُ فِي الْأَهْلِ. اَللّٰهُمَّ إِنِّي أَعُوْذُ بِكَ مِنْ وَعْثَاءِ السَّفَرِ وَكَأٓبَةِ الْمَنْظَرِ. وَسُوْءِ الْمُنْقَلَبِ فِي الْمَالِ وَالْأَهْلِ وَالْوَلَدِ','Allahu Akbar, Allahu Akbar, Allahu Akbar. Subhanalladzi sakkhoro lana hadza wa maa kunnaa lahu muqrinin, wa innaa ilaa robbinaa lamunqolibun, allahumma inna nas\'aluka fii safarinaa hadzal birro wat taqwa wa minal \'amal maa tardho, allahumma hawwin \'alaina safarona hadza wa athwi \'annaa bu\'dahu, allahumma antas shohibu fis safari wal kholifatu fil ahli, allahumma inni a\'udzubika min wa\'tsaais safari wa kaabatil mandzhori wa suuil munqolibi fil maali wal ahli wal walad.','Dengan Nama Allah Yang Maha Pemurah lagi Maha Penyayang. Allah Maha Besar, Allah Maha Besar, Allah Maha Besar. Maha Suci Allah Yang telah menggerakkan untuk kami kendaraan ini padahal kami tiada kuasa menggerakkannya. Dan sesungguhnya kepada Tuhan, kami pasti akan kembali. Ya Allah, kami memohon kepada-Mu dalam perjalanan ini kebaikan dan takwa serta amal perbuatan yang Engkau ridhai. Ya Allah, mudahkanlah perjalanan ini dan dekatkanlah jaraknya bagi kami. Ya Allah, Engkaulah teman dalam bepergian dan pelindung terhadap keluarga yang ditinggalkan. Ya Allah, kami berlindung kepada-Mu dari kelelahan dalam bepergian, pemandangan yang menyedihkan, dan kepulangan yang menyusahkan dalam harta benda, keluarga, dan anak.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(4,4,'',1,'اللّٰهُمَّ إِنِّي أَسْأَلُكَ مِنْ خَيْرِ هٰذِهِ الْأَرْضِ وَخَيْرِمَا جُمِعَتْ فِيْهَا وَأَعُوْذُ بِكَ مِنْ شَرِّهَا وَشَرِّ مَا جُمِعَتْ فِيْهَا. اَللّٰهُمَّ ارْزُقْنَا حِمَاهَا. وَأَعِدْنَا مِنْ وَبَاهَا. وَحَبِّبْنَا إِلَى أَهْلِهَا. وَحَبِّبْ صَالِحِي أَهْلِهَا إِلَيْنَا','Allahumma inni as aluka min khoiri hadzihil ardhi wa khoiri maa jumi\'at fiiha wa a\'udzubika min syarra haa wa syarra maa jumi\'at fiiha. Allahummarzuqna himaha, wa a\'idna min wabaha, wahabbabna ila ahliha, wa habbab sholihi ahliha ilaina.','Ya Allah, aku mohon yang terbaik dari bumi ini dan segala kebaikan yang terhimpun di dalamnya dan aku berlindung kepada-Mu dari keburukannya dan segala keburukan yang terhimpun di dalamnya. Ya Allah, berilah kami perlindungan, dan lindungilah kami dari wabahnya, buatlah kami dapat mencintai penduduknya dan penduduknya yang solih mencintai kami.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(5,5,'',1,'اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَهَا وَخَيْرَمَا فِيْهَا وَخَيْرَمَا أَرْسَلْتَ بِهِ أَهْلِهَا وَأَعُوْذُ بِكَ مِنْ شَرِّهَا وَشَرِّ أَهْلِهَا وَشَرِّ مَا فِيْهَا وَشَرِّ مَا أَرْسَلْتَ بِهِ','Allahumma inni as aluka khairaha wa khaira ma fiha wa khaira ma arsalta bihi ahlihaa wa a\'udzubika min syarrahaa wa syarra ahlihaa wasyarra maa fiha wa syarra ma arsaltabih.','Ya Allah, aku memohon pada-Mu kebaikan negeri ini dan kebaikan penduduknya serta kebaikan yang ada di dalamnya. Dan aku berlindung pada-Mu dari kejahatan negeri ini dan kejahatan penduduknya.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(6,6,'',1,'لَبَّيْكَ اللّٰهُمَّ عُمْرَةً','Labbaikallahumma ‘umratan','Aku sambut panggilan-Mu Ya Allah untuk berumrah.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(7,7,'',1,'نَوَيْتُ اْلعُمْرَةَ وَأَحْرَمْتُ بِهَا لِلَّهِ تَعَالَى','Nawaitul \'umrata wa ahramtu bihi lillahi ta\'ala.','Aku berniat umrah dengan berihram karena Allah Ta\'ala.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(8,8,'',1,'لَبَّيْكَ اللَّهُم حَجَّا','Labbaikallaahumma hajjan','Aku sambut panggilan-Mu Ya Allah untuk berhaji',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(9,9,'',1,'نَوَيْتُ الْحَجَّ وَأَحْرَمْتُ بِهِ لِلَّهِ تَعَالَي','Nawaitul hajja wa ahramtu bihi lillahi ta\'ala.','Aku niat haji dengan berihram karena Allah Ta\'ala.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(10,10,'',1,'لَبَّيْكَ اللّٰهُمَّ حَجًّا وَعُمْرَةً','Labbaikallaahumma hajjan wa umratan','Aku datang memenuhi panggilan-Mu Ya Allah untuk berhaji dan umrah.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(11,11,'',1,'نَوَيْتُ الْحَجَّ وَالْعُمْرَةَ وَأَحْرَمْتُ بِهِمَا لِلَّهِ تَعَالَى ','Nawaitul hajja wal \'umrata wa ahramtu bihima lillahi ta\'ala.','Aku niat haji dan umrah dengan berihram untuk haji dan umrah karena Allah Ta\'ala.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(12,12,'',1,'اللَّهُمَّ أُحَرِّمُ شَعْرِي وَبَشَرِيْ وَجَسَدِيْ وَجَمِيْعَ جَوَارِحِيْ مِنْ كُلِّ شَيْءٍ حَرَّمْتَهُ عَلَى الْمُحْرِمِ أَبْتَغِي بِذلِكَ وَجْهَكَ الْكَرِيْمَ يَارَبَّ الْعَالَمِيْنَ','Allahumma uharrimu sya\'ri wa basyari wa jasadi wa jami\'a jawarihi min kulli syai-in harramtahu \'alal muhrimi abtaghi bidzalika wajhakal karim ya rabbal \'alamin.','Ya Allah, aku haramkan rambut, kulit, tubuh, dan seluruh anggota tubuhku dari semua yang Engkau haramkan bagi seorang yang sedang berihram, demi mengharapkan diri-Mu semata, wahai Tuhan pemelihara alam semesta.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(13,13,'',1,'لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ، لَبَّيْكَ لَا شَرِيْكَ لَكَ لَبَّيْكَ، إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالمُلْكَ لاَ شَرِيكَ لَكَ','Labbaikallahuma labbaik, labbaika laa syariika laka labbaik, innal hamda wa ni\'mata laka wal mulk laa syarika laka.','Aku sambut panggilan-Mu ya Allah, aku sambut panggilan-Mu, aku sambut panggilan-Mu tidak ada sekutu bagi-Mu, aku sambut panggilan-Mu. segala puji, kemuliaan, dan segenap kekuasaan adalah milik-Mu, tidak ada sekutu bagi-Mu.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(14,14,'',1,'اللَّهُمَّ صَلِّ وَسَلّمْ عَلَى سَيِّدِنَا مُحَمَّدٍ وَعَلَىٰ أَلِ سَيِّدِنَا مُحَمَّدٍ','Allahumma shalli wa sallim \'ala sayyidina Muhammad wa \'ala ali sayyidina Muhammad.','Ya Allah, limpahkan rahmat dan keselamatan kepada Nabi Muhammad SAW dan keluarganya.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(15,15,'',1,'اللَّهُمَّ إِنَّا نَسْأَلُكَ رِضَاكَ وَالْجَنَّةَ وَنَعُوْذُ بِكَ مِنْ سَخَطِكَ والنَّارِ. اَللَّهُمَّ رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ','Allahumma inna nas aluka ridhaka wal jannah, wana\'udzu bika min sakhatika wan nar, rabbana atina fiddunya hasanah, wa fil akhirati hasanah wa qina \'adzaban naar.','Ya Allah, sesungguhnya kami memohon keridhaan-Mu dan surga, kami berlindung pada-Mu dari murka-Mu dan siksa neraka. Wahai Tuhan kami, berilah kami kebaikan di dunia dan kebaikan di akhirat serta hindarkanlah kami dari siksa neraka.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(16,16,'',1,'اَللّٰهُمَّ هٰذَا حَرَمُكَ وَأَمْنُكَ فَحَرِّمْ لَحْمِي وَدَمِيْ وَشَعْرِي وَبَشَرِيْ عَلَى النَّارِ وَأٰمِنِّي مِنْ عَذَابِكَ يَوْمَ تَبْعَثُ عِبَادَكَ وَاجْعَلْنِي مِنْ أَوْلِيَآئِكَ وَأَهْلِ طَاعَتِكَ','Allaahumma haadzaa haramuka wa amnuka faharrim lahmii wadamii wasya\'rii wabasyarii \'alan-naari wa aaminnii min \'adzaabika yauma tab\'atsu \'ibaadaka waj\'alnii min auliyaa-ika wa-ahli thaa\'atika','Ya Allah, kota ini adalah tanah haram-Mu dan tempat aman-Mu, maka hindarkanlah daging, darah, rambut, dan kulitku dari neraka. Dan selamatkanlah diriku dari siksa-Mu pada hari Engkau membangkitkan kembali hamba-Mu, dan jadikanlah aku termasuk orang- orang yang selalu dekat dan taat kepada-Mu.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(17,17,'',1,'اَللّٰهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ وَإِلَيْكَ يَعُوْدُ السَّلَامُ فَحَيِّنَا رَبَّنَا بِالسَّلَامِ وَأَدْخِلْنَا الْجَنَّةَ دَارَالسَّلَامِ تَبَارَكْتَ رَبَّنَا وَتَعَالَيْتَ يَا ذَالْجَلَالِ وَالْإِكْرَامِ. اَللّٰهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ. بِسْمِ اللَّهِ وَالْحَمْدُ لِلَّهِ وَالصَّلَاةُ وَالسَّلَامُ عَلَى رَسُوْلِ اللّٰهِ','Allaahumma antas salaamu waminkas salaamu wailaika ya\'uudus salaamu fahayyinaa rabbanaa bis-salaami wa- adkhilnal jannata daaras salaami tabaarakta rabbanaa wata\'aalaita yaa dzal jalaali wal-ikraami. Allaahummaftah lii abwaaba rahmatika. Bismillaahi walhamdu lillaahi wash-shalaatu was- salaamu \'alaa rasuulillaahi.','Ya Allah, Engkau sumber keselamatan dan daripada-Mulah datangnya keselamatan dan kepada-Mu kembalinya keselamatan. Maka hidupkanlah kami wahai Tuhan, dengan selamat sejahtera dan masukkanlah kami ke dalam surga negeri keselamatan. Maha Banyak anugerah-Mu dan Maha Tinggi Engkau wahai Tuhan yang memiliki keagungan dan kehormatan. Ya Allah, bukakanlah untukku pintu-pintu rahmat-Mu (aku masuk masjid ini) dengan nama Allah disertai dengan segala puji bagi Allah serta shalawat dan salam untuk Rasulullah.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(18,18,'',1,'اَللّٰهُمَّ زِدْ هٰذَا الْبَيْتَ تَشْرِيْفًا وَتَعْظِيمًا وَتَكْرِيمًا وَمَهَابَةً. وَزِدْ مَنْ شَرَّفَهُ وَكَرَّمَهُ مِمَّنْ حَجَّهُ أَوِ اعْتَمَرَهُ تَشْرِيفًا وَتَعْظِيمًا وَتَكْرِيمًا وَبِرًّا','Allaahumma zid haadzal baita tasyriifan wata\'zhiiman wamahaabatan. Wazid man syarrafahu wakarramahu mimman hajjahu awi\'tamarahu tasyriifan wa ta\'zhiiman wa takriiman wabirran.','Ya Allah, tambahkanlah kemuliaan, keagungan, kehormatan, dan wibawa pada Bait (Ka\'bah) ini. Dan tambahkan pula pada orang-orang yang memuliakan, mengagungkan, dan menghormatinya di antara mereka yang berhaji atau yang berumrah dengan kemuliaan, keagungan, kehormatan, dan kebaikan.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(19,19,'',1,'بِسْمِ اللَّهِ اَللّٰهُ أَكْبَرُ','Bismillāhi allāhu akbar.','Dengan nama Allah, Allah Maha Besar.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(20,20,'',1,'سُبْحَانَ اللّٰهِ وَالْحَمْدُ لِلّٰهِ وَلَا إِلَهَ إِلَّا اللّٰهُ وَاللّٰهُ أَكْبَرُ وَلَاحَوْلَ وَلَا قُوَّةَ إِلَّا بِاللّٰهِ الْعَلِيّ الْعَظِيمِ وَالصَّلَاةُ وَالسَّلامُ عَلَى رَسُوْلِ اللّٰه صَلَّى اللَّه عَلَيْهِ وَسَلَّمَ. اللَّهُمَّ إِيْمَانًا بِكَ وَتَصْدِيقًا بِكِتَابِكَ وَوَفَاءً بِعَهْدِكَ وَاتِّبَاعًا لِسُنَّةِ نَبِيِّكَ مُحَمَّدٍ صَلَّى اللّٰهُ عَلَيْهِ وَسَلَّمَ. اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ وَالْمُعَافَاةَ الدَّائِمَةَ فِي الدِّيْنِ وَالدُّنْيَا وَالْأَخِيرَةِ وَالْفَوْزَ بِالْجَنَّةِ وَالنَّجَاةَمِنَ النَّارِ','Subhaanallaahi, walhamdulillaahi, walaa ilaaha illallaahu wallaahu akbaru, walaa haula walaa quwwata illaa billaahil \'aliyyil \'azhiimi, wash-shalaatu was-salaamu \'alaa rasuulillaahi shallallaahu \'alaihi wasallama. Allaahumma iimaanan bika wa tashdiiqan bikitaabika, wa wafaaan bi\'ahdika, wattibaa\'an lisunnati nabiyyika Muhammadin shallallaahu \'alaihi wasallama. Allaahumma innii as-alukal \'afwa, wal-\'aafiyata, wal-mu\'aafaatad daa-imata, fid- diini wad-dunyaa wal-aakhirata, wal-fauza bil- jannati, wan-najaata minan-naar.','Maha Suci Allah, segala puji bagi Allah, tidak ada Tuhan selain Allah, Allah Maha Besar. Tiada daya (untuk memperoleh manfaat) dan tiada kemampuan (untuk menolak bahaya) kecuali dengan pertolongan Allah Yang Maha Mulia dan Maha Agung. Shalawat dan salam bagi Rasulullah SAW. Ya Allah, aku thawaf ini karena beriman kepada-Mu, membenarkan kitab-Mu dan memenuhi janji-Mu dan mengikuti sunnah Nabi-Mu Muhammad SAW. Ya Allah, sesungguhnya aku mohon kepada-Mu ampunan. Kesehatan dan perlidungan yang kekal dalam menjalankan agama, di dunia dan di akhirat dan beruntung memperoleh surga dan terhindar dari siksa neraka',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(21,21,'',1,'اَللّٰهُمَّ إِنَّ هٰذَا الْبَيْتَ بَيْتُكَ وَالْحَرَمَ حَرَمُكَ وَالْأَمْنَ أَمْنُكَ وَالْعَبْدَ عَبْدُكَ وَأَنَا عَبْدُكَ وَابْنُ عَبْدِكَ وَهٰذَا مَقَامُ الْعَائِذِ بِكَ مِنَ النَّارِ . فَحَرِّمْ لُحُوْمَنَا وَبَشَرَتَنَا عَلَى النَّارِ. اَللَّهُمَّ حَبِّبْ إِلَيْنَا الْإِيْمَانَ وَزَيِّنْهُ فِي قُلُوْبِنَا وَكَرِّهْ إِلَيْنَا الْكُفْرَ وَالْفُسُوْقَ وَالْعِصْيَانَ وَاجْعَلْنَا مِنَ الرَّاشِدِيْنَ . اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ. اللَّهُمَّ ارْزُقْنِي الْجَنَّةَ بِغَيْرِ حِسَابٍ','Allaahumma inna haadzal baita baituka wal-harama haramuka, wal-amna amnuka, wal-\'abda \'abduka, wa ana \'abduka wabnu \'abdika, wa haadzaa maqaamul \'aa-idzi bika minan naari, faharrim luhuumanaa wa- basyaratanaa \'alan naari. Allaahumma hab- bib ilainal iimaana, wa zayyinhu fii quluu- binaa wa karrih ilainal kufra wal-fusuuqa wal-\'ishyaana, waj\'alnaa minar raasyidii- na. Allaahumma qinii \'adzaabaka yauma tab\'atsu \'ibaadaka, Allaahummarzuqnil jannata bighairi hisaab.','Ya Allah, sesungguhnya Bait ini rumah-Mu, tanah mulia ini tanah-Mu, negeri aman ini negeri-Mu, hamba ini hamba-Mu anak dari hamba-Mu, dan tempat ini adalah tempat orang berlindung pada-Mu dari siksa neraka, maka haramkanlah daging dan kulit kami dari siksa neraka. Ya Allah, cintakanlah kami pada iman dan biarkanlah ia menghias hati kami, tanamkanlah kebencian pada diri kami pada perbuatan kufur, fasiq, maksiat dan durhaka serta masukkanlah kami dalam golongan orang yang mendapat petunjuk. Ya Allah, lindungilah aku dari azab-Mu di hari Engkau kelak membangkitkan hamba- hamba-Mu. Ya Allah anugerahkanlah surga kepadaku tanpa hisab.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(22,22,'',1,'اَللّٰهُمَّ إِنِّي أَعُوْذُبِكَ مِنَ الشَّكِّ وَالشِّرْكِ وَالشِّقَاقِ وَالنِّفَاقِ وَسُوْءِ الْأَخْلَاقِ وَالْمَنْظَرِ وَالْمُنْقَلَبِ فِيْ الْمَالِ وَالْأَهْلِ وَالوَلَدِ. اَللّٰهُمَّ إِنِّي أَسْأَلُكَ رِضَاكَ وَالْجَنَّةَ وَأَعُوْذُبِكَ مِنْ سَخَطِكَ وَالنَّارِ . اَللّٰهُمَّ إِنِّي أَعُوْذُبِكَ مِنْ فِتْنَةِ الْقَبْرِ وَأَعُوْذُبِكَ مِنْ فِتْنَةِ الْمَحْيَاوَالْمَمَاتِ','Allaahumma innii a\'uudzu bika minasy syakki wasy-syirki wasy-syiqaaqi wan- nifaaqi wasuu-il akhlaaqi wasuu-il manzhari wal-munqalabi fil-maali wal-ahli wal-waladi. Allaahumma innaa nas-aluka ridhaaka wal-jannata wa na\'uudzu bika min sakhathika wan-naari. Allaahumma innii a\'uudzu bika min fitnatil qabri wa a\'uudzu bika min fitnatil mahyaa wal- mamaat.','Ya Allah, aku berlindung kepada-Mu dari keraguan, syirik, percekcokan, kemunafikan, buruk budi pekerti dan penampilan dan kepulangan yang jelek dalam hubungan dengan harta benda, keluarga dan anak-anak. Ya Allah, sesungguhnya aku mohon kepada- Mu keridhaan-Mu dan surga. Dan aku berlindung pada- Mu daripada murka-Mu dan siksa neraka. Ya Allah, aku berlindung pada-Mu dari fitnah kubur, dan aku berlindung pada-Mu dari fitnah kehidupan dan derita kematian.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(23,23,'',1,'اَللّٰهُمَّ اجْعَلْهُ حَجًّا مَبْرُوْرًا وَسَعْيًا مَشْكُورًا وَذَنْبًا مَغْفُوْرًا وَعَمَلاً صَالِحًا مَقْبُوْلاً وَتِجَارَةً لَنْ تَبُوْرَ.  يَا عَالِمَ مَا فِي الصُّدُوْرِ أَخْرِجْنِي يَا اَللّٰهُ مِنَ الظُّلُمَاتِ إِلَى النُّوْرِ','Allaahummaj\'alhu hajjan mabruuran, wa sa\'yan masykuuran, wa dzanban maghfuuran, wa \'amalan shaalihan maqbuulan, wa tijaaratan lan tabuura. Yaa \'aalimu maa fish-shuduuri, akhrijnii ya Allaahu minazh-zhulumaati ilan-nuuri','Ya Allah karuniakanlah umrah yang maqbul, sa\'i yang diterima, dosa yang diampuni, amal shaleh yang diterima dan usaha yang tidak akan mengalami rugi. Wahai Tuhan yang Maha Mengetahui apa-apa yang terkandung dalam hati sanubari. Keluarkanlah aku dari kegelapan ke cahaya yang terang benderang.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(24,23,'',2,'اَللّٰهُمَّ إِنِّي أَسْأَلُكَ مُوْجِبَاتِ رَحْمَتِكَ وَعَزَائِمَ مَغْفِرَتِكَ وَالسَّلَامَةَ مِنْ كُلِّ إِثْمٍ وَالْغَنِيْمَةَ مِنْ كُلِّ بِرٍّ وَالْفَوْزَ بِالْجَنَّةِ وَالنَّجَاةَ مِنَ النَّار','Allaahumma innii as-aluka muujibaati rahmatika, wa \'azaa-ima maghfiratika, was-salaamata min kulli itsmin, wal- ghaniimata min kulli birrin, wal-fauza biljannati, wan-najaata minan naari','Ya Allah, aku mohon kepada-Mu segala hal yang mendatangkan rahmat-Mu dan keteguhan ampunan-Mu selamat dari segala dosa dan beruntung dengan mendapat berbagai kebaikan, beruntung memperoleh surga, terhindar dari siksa neraka.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(25,23,'',3,'رَبِّ قَنِّعْنِي بِمَا رَزَقْتَنِي وَبَارِكْ لِيْ فِيْمَا أَعْطَيْتَنِي وَاخْلُفْ عَلَيَّ كُلَّ غَائِبَةٍ لِيْ مِنْكَ بِخَيْرٍ','Rabbi qanni\'nii bimaa razaqtanii, wa baarik lii fiimaa a\'thaitanii, wakhluf \'alayya kulla ghaa-ibatin lii minka bikhaiir','Ya Tuhanku, puaskanlah aku dengan anugerah yang telah Engkau berikan dan berkatilah untukku semua yang Engkau anugerahkan anugerahkan kepadaku dan gantilah segala yang terlepas dari pandanganku dengan kebaikan yang berasal dari sisi-Mu.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(26,24,'',1,'اَللّٰهُمَّ أَظِلَّنِي تَحْتَ ظِلِّ عَرْشِكَ يَوْمَ لَا ظِلَّ إِلَّا ظِلُّكَ وَلَا بَاقِيَ إِلَّا وَجْهُكَ وَاَسْقِنِي مِنْ حَوْضِ نَبِيِّكَ مُحَمَّدٍ صَلَّى اللّٰهُ عَلَيْهِ وَسَلَّمَ شُرْبَةً هَنِيئَةً مَرِيئَةً لَا أَظْمَأُ بَعْدَهَا أَبَدًا. اَللّٰهُمَّ إِنِّي أَسْأَلُكَ مِنْ خَيْرٍ مَا سَأَلَكَ مِنْهُ نَبِيُّكَ مُحَمَّدٌ صَلَّى اللّٰهُ عَلَيْهِ وَسَلَّمَ وَأَعُوْذُبِكَ مِنْ شَرِّ مَا اسْتَعَاذَكَ مِنْهُ نَبِيُّكَ مُحَمَّدٌ صَلَّى اللّٰهُ عَلَيْهِ وَسَلَّمَ . اَللّٰهُمَّ إِنِّي أَسْأَلُكَ الْجَنَّةَ وَنَعِيْمَهَا وَمَا يُقَرِّبُنِي إِلَيْهَا مِنْ قَوْلٍ أَوْ فِعْلٍ أَوْ عَمَلٍ وَأَعُوْذُبِكَ مِنَ النَّارِ وَمَا يُقَرِّبُنِي إِلَيْهَا مِنْ قَوْلٍ أَوْ فِعْلٍ أَوْ عَمَلٍ','Allaahumma azhillanii tahta zhilli \'arsyika yaumalaazhillaillaazhilluka walaa baaqiya illaa wajhuka, wa asqinii min haudhi nabiyyika Muhammadin shallallaahu \'alaihi wasallama syurbatan hanii\'atan marii-atan, laa azhma\'u ba\'dahaa abada. Allaahumma innii as-aluka min khairi maa sa-alaka minhu nabiyyuka Muhammadin shallallaahu \'alaihi wasallama, wa-a\'uudzu bika min syarri masta\'aadzaka minhu nabiyyuka Muhammadin shallallaahu \'alaihi wasallama. Allaahumma innii as- alukal jannata wa na\'iimahaa wamaa yuqarribunii ilaihaa min qaulin au fi\'lin au \'amalin, wa-a\'uudzu bika minan naari wamaa yuqarribunii ilaihaa min qaulin au fi\'lin au \'amal.','Ya Allah, lindungilah kami di bawah naungan singgasana-Mu pada hari yang tidak ada naungan selain naunganMu dan tidak ada yang kekal kecuali Zat-Mu. Ya Allah, berilah aku minuman dari telaga Nabi Muhammad SAW dengan suatu minuman yang sesudah itu aku tidak akan haus untuk selamanya. Ya Allah, aku mohon pada-Mu kebaikan yang dimohonkan oleh Nabi-Mu Muhammad SAW dan aku berlindung pada-Mu dari kejahatan yang dimintakan perlindungan oleh Nabi-Mu Muhammad SAW. Ya Allah, aku mohon pada-Mu surga serta nikmatnya dan apapun yang dapat mendekatkan aku kepadanya, baik ucapan maupun amal perbuatan dan aku berlindung pada-Mu dari neraka serta apapun yang mendekatkan aku kepadany baik ucapan ataupun amal perbuatan, dan aku mohon pada-Mu agar menjadikan semua takdirku dengan takdir yang baik.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(27,25,'',1,'اَللّٰهُمَّ إِنَّ لَكَ عَلَيَّ حُقُوْقًا كَثِيرَةً فِيْمَا بَيْنِي وَبَيْنَكَ وَحُقُوْقًا كَثِيرَةً فِيْمَا بَيْنِي وَبَيْنَ خَلْقِكَ. اَللّٰهُمَّ مَا كَانَ لَكَ مِنْهَا فَاغْفِرْهُ لِي وَمَا كَانَ لِخَلْقِكَ فَتَحَمَّلْهُ عَنِّي وَأَغْنِنِي بِحَلَالِكَ عَنْ حَرَامِكَ وَبِطَاعَتِكَ عَنْ مَعْصِيَتِكَ وَبِفَضْلِكَ عَمَّنْ سِوَاكَ يَا وَاسِعَ الْمَغْفِرَةِ. اَللّٰهُمَّ إِنَّ بَيْتَكَ عَظِيمٌ وَوَجْهَكَ كَرِيمٌ وَأَنْتَ يَا اللّٰه حَلِيمٌ كَرِيمٌ عَظِيمٌ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي','Allahumma inna laka \'alayya huquuqan katsiirata fiimaa bainii wa bainaka wa huquuqan katsiiratan fiimaa baitii wa baina khalqika. Allaahumma maa kaana laka minhaa faghfirhu lii wamaa kaana likhalqika fatahammalhu \'annii, wa aghninii bihalaalika \'an haraamika, wa bithaa\'atika \'an ma\'shiyatika, wa bifadhlika \'amman siwaaka, yaa waasi\'al maghfirah. Allaahumma inna baitaka \'azhiimun, wa wajhaka kariimun, wa anta yaa Allaahu haliimun, kariimun \'azhiimun tuhibbul \'afwa fa\'fu \'annii.','Ya Allah, sesungguhnya Engkau mempunyai hak kepadaku banyak sekali hak dalam hubunganku dengan Engkau dan Engkau juga mempunyai hak banyak sekali dengan makhluk-Mu. Ya Allah, apa yang menjadi hak-Mu kepadaku, maka ampunilah diriku dan apa saja yang menjadi hak-Mu kepada makhluk-Mu, maka tanggunglah dariku. Cukupkanlah aku dengan rezeki-Mu yang halal, terhindar dari yang haram, dengan taat kepada-Mu, terhindar dari kemaksiatan dan dengan anugerah-Mu terhindar dari pada mengharapkan dari orang lain selain kepada-Mu, Wahai Tuhan Yang Maha Pengampun. Ya Allah, sesungguhnya rumah-Mu (Baitullah) ini Agung, Zat-Mu pun Mulia. Engkau Maha Penyabar, Maha Pemurah, Maha Agung yang sangat suka memberi ampun, maka ampunilah aku.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(28,26,'',1,'اَللّٰهُمَّ إِنِّي أَسْأَلُكَ إِيْمَانًا كَامِلاً وَيَقِينًا صَادِقًا وَرِزْقًا وَاسِعًا وَقَلْبًا خَاشِعًا وَلِسَانًا ذَاكِرًا وَرِزْقًا حَلَالاً طَيِّبًا وَتَوْبَةً نَصُوحًا وَتَوْبَةً قَبْلَ الْمَوْتِ وَرَاحَةً عِنْدَ الْمَوْتِ وَمَغْفِرَةً وَرَحْمَةً بَعْدَ الْمَوْتِ وَالْعَفْوَ عِنْدَ الْحِسَابِ وَالْفَوْزَ بِالْجَنَّةِ وَالنَّجَاةَ مِنَ النَّارِ بِرَحْمَتِكَ يَا عَزِيزُ يَا غَفَّارُ . رَبِّ زِدْنِي عِلْمًا وَأَلْحِقْنِي بِالصَّالِحِيْنَ','Allaahumma innii as-aluka iimaanan kaamilan, wa yaqiinan shaadiqan, wa rizqan waasi\'an, wa qalban khaasyi\'an, wa lisaanan dzaakiran, wa rizqan halalan thayyiban, wa taubatan nashuuhan, wa taubatan qablal mauti, wa rahatan \'indal mauti, wa maghfiratan wa rahmatan ba\'dal mauti, wal-\'afwa\'indal hisaabi, wal fauza bil-jannati, wan-najaata minan naari, birahmatika yaa \'aziizu yaa ghaffaaru. Rabbi zidnii ilman wa-alhiqnii bish-shaalihiin','Ya Allah, aku mohon pada-Mu iman yang sempurna, keyakinan yang benar, ilmu yang bermanfaat, rezeki yang luas, rezeki yang halal dan baik, hati yang khusyu\', lidah yang selalu berzikir, taubat yang semurni murninya dan taubat sebelum mati, ampunan dan rahmat sesudah mati.\n\nYa Allah aku mohon kepadamu ketenangan ketika mati dan ampunan ketika hisab, serta keberuntungan dengan memperoleh surga dan terhindar dari neraka dengan kasih sayangMu. Wahai Tuhan Yang Maha Perkasa, Yang Maha Pengampun. Tuhanku, tambahan ilmu pengetahuan dan gabungkan aku ke dalam golongan orang-orang yang saleh.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(29,27,'',1,'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ','Rabbanaa aatinaa fid-dunyaa hasanatan wafil-aakhirati hasanatan waqinaa \'adzaaban naar. ','Wahai Tuhan kami, berilah kami kebaikan di dunia dan kebaikan di akhirat, dan hindarkanlah kami dari siksa neraka. Dan masukkanlah kami ke dalam surga bersama orang-orang yang berbuat baik, wahai Tuhan Yang Maha Perkasa, Maha Pengampun dan Tuhan yang menguasai seluruh alam',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(30,27,'',2,'وَادْخِلْنَا الْجَنَّةَ مَعَ الْأَبْرَارِ. يَا عَزِيزُ يَا غَفَّارُ يَا رَبَّ العَالَمِينَ','Wa adkhilnal jannata ma\'al abraari. Yaa \'aziizu yaa ghaffaaru yaa rabbal \'aalamiin.','',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(31,28,'',1,'اَللّٰهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا وَرِزْقًا وَاسِعًا وَشِفَاءً مِنْ كُلِّ دَاءٍ وَسَقَمٍ بِرَحْمَتِكَ يَا أَرْحَمَ الرَّاحِمِينَ','Allaahumma innii as-aluka \'ilman naafi\'an, wa rizqan waasi\'an, wa syifaa-an min kulli daa-in wa saqamin, birahmatika yaa arhamar raahimiin.','Ya Allah, aku mohon pada-Mu ilmu pengetahuan yang bermanfaat, rizki yang luas dan kesembuhan dari segala penyakit dan kepedihan dengan rahmat-Mu ya Allah Tuhan Yang Maha Pengasih dari segenap yang pengasih.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(32,29,'',1,'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ. أَبْدَأُ بِمَا بَدَأَ اللّٰهُ بِهَ وَرَسُوْلُهُ . إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَائِرِ اللَّهِ. فَمَنْ حَجَّ الْبَيْتَ أَوِعْتَمَرَ فَلاَ جُنَاحَ عَلَيْهِ أَنْ يَطَوَّفَ بِهِمَا وَمَنْ تَطَوَّعَ خَيْرًا فَإِنَّ اللّٰهَ شَاكِرٌ عَلِيمٌ','Bismillaahir rahmaanir rahiim. Abda-u bi- maa bada-Allaahu bihi wa rasuulihi, innashshafaa wal-marwata min sya\'aa-irillaahi, faman hajjal baita awi\'tamara falaa ju- naaha \'alaihi an yaththawwafa bihimaa wa man tathawwa\'a khairan fa-innallaaha syaakirun \'aliim.','Dengan nama Allah yang Maha Pengasih lagi Maha Penyayang. Aku mulai dengan apa yang telah dimulai oleh Allah dan rasul-Nya. Sesungguhnya Shafa dan Marwah sebagian dari syiar-syiar (tanda kebesaran) Allah. Maka barangsiapa yang beribadah haji ke Baitullah atau pun berumrah, maka tidak ada dosa baginya mengerjakan Sa\'i antara keduanya. Dan barangsiapa yang mengerjakan suatu kebajikan dengan kerelaan hati, maka sesungguhnya Allah Maha Penerima Kebaikan lagi Maha Mengetahui.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(33,30,'',1,'اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ وَلِلّٰهِ الْحَمْدُ. اللّٰهُ أَكْبَرُ عَلَى مَا هَدَانَا وَالْحَمْدُ لِلَّهِ عَلَى مَا أَوْلَانَا . لَا إِلَهَ إِلَّا اللّٰهُ وَحْدَهُ لَا شَرِيْكَ لَهُ. لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ يُحْيِي وَيُمِيْتُ بِيَدِهِ الْخَيْرِ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ . لَا إِلَهَ إِلَّا اللّٰهُ وَحْدَهُ لَا شَرِيْكَ لَهُ أَنْجَزَ وَعْدَهُ وَنَصَرَ عَبْدَهُ وَهَزَمَ الأَحْزَابَ وَحْدَهُ لاَ إِلَهَ إِلَّا اللّٰهُ وَلَا نَعْبُدُ إِلَّا إِيَّاهُ مُخْلِصِينَ لَهُ الدِّيْنَ وَلَوْ كَرِهَ الْكَافِرُوْنَ','Allaahu akbar, Allaahu akbar, Allaahu akbar, wa lillaahil hamd, Allaahu akbaru \'alaa maa hadaanaa walhamdu lillaahi \'alaa maa aulaanaa. Laa ilaaha illallaahu wahdahu laa syariika lahu, lahul mulku wa lahul hamdu yuhyii wa yumiitu biyadihil khairu wa huwa \'alaa kulli syai-in qadiir. Laa ilaaha illallaahu wahdahu laa syariika lahu anjaza wa\'dahu wa nashara \'abdahu wa hazamal ahzaaba wahdahu laa ilaaha illallaahu walaa na\'budu illaa iyyaahu mukhlishiina lahud diina walau karihal kaafiruun','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar. Segala puji bagi Allah, Allah Maha Besar, atas petunjuk yang diberikan-Nya kepada kami, segala puji bagi Allah atas karunia yang telah dianugerahkan- Nya kepada kami, tidak ada Tuhan selain Allah Yang Maha Esa, tidak ada sekutu bagi-Nya. Bagi-Nya kerajaan dan pujian. Dialah yang menghidupkan dan mematikan, pada kekuasaan-Nya lah segala kebaikan dan Dia berkuasa atas segala sesuatu. Tiada Tuhan selain Allah Yang Maha Esa, tidak ada sekutu bagi-Nya, yang telah menepati janji-Nya, menolong hamba-Nya, dan menghancurkan sendiri musuh-musuh-Nya. Tidak ada Tuhan selain Allah dan kami tidak menyembah kecuali kepada-Nya dengan memurnikan (ikhlas) kepatuhan semata kepada- Nya walaupun orang-orang kafir membenci.',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(34,31,'',1,'اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ. اَللّٰهُ أَكْبَرُ كَبِيرًا وَالْحَمْدُ لِلّٰهِ كَثِيرًا وَسُبْحَانَ اللّٰهِ الْعَظِيمِ وَبِحَمْدِهِ الْكَرِيمِ بُكْرَةً وَأَصِيْلاً وَمِنَ اللَّيْلِ فَاسْجُدْ لَهُ وَسَبِّحْهُ لَيْلا طَوِيلاً لَا إِلَهَ إِلَّا اللّٰه وَحْدَهُ أَنْجَزَ وَعْدَهُ وَنَصَرَ عَبْدَهُ وَهَزَمَ الْأَحْزَابَ وَحْدَهَ لَا شَيْئَ قَبْلَهُ وَلَا بَعْدَهُ يُحْيِ وَيُمِيْتُ وَهُوَ حَيٌّ دَائِمٌ لَا يَمُوْتُ وَلَا يَفُوْتُ أَبَدًا بِيَدِهِ الْخَيْرِوَإِلَيْهِ الْمَصِيرُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ','Allaahu akbar, Allaahu akbar, Allaahu akbar. Allaahu akbaru kabiira, walhamdu lillaahi katsiira, wa subhaanal \'azhiimi wa bihamdihil kariimi, bukratan wa-ashiilaa, wa minal laili fasjud lahu, wa sabbihhu lailan thawiilan laa ilaaha illallaahu wahdahu, anjaza wa\'dahu, wa nashara \'abdahu, wa hazamal ahzaaba wahdahu, laa syai-a qablahu walaa ba\'dahu, yuhyii wa yumiitu, wa huwa hayyun daa-imun, laa yamuutu walaa yafuutu abadan, biyadihil khair, wa-ilaihil mashiir, wa huwa \'alaa kulli syai-in qadiir','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar, Allah Maha Besar dengan segala kebesaran- Nya. Segala puji bagi Allah Yang Maha Agung dengan segala pujian-Nya yang tidak terhingga. Maha Suci Allah Yang Maha Agung dengan pujian, Yang Maha Mulia di waktu pagi dan petang. Dan pada sebagian malam, bersujud dan bertasbihlah pada-Nya sepanjang malam. Tidak ada Tuhan selain Allah Yang Maha Esa yang menepati janji-Nya membela hamba-hamba-Nya yang menghancurkan musuh-musuh-Nya dan tidak ada sesuatu sebelum-Nya dan tidak ada sesuatu pun sesudah- Nya. Dialah yang menghidupkan dan mematikan dan Dia adalah Maha Hidup Kekal tiada mati dan tiada musnah (hilang) untuk selama-lamanya. Hanya di tangan-Nyalah terletak kebajikan dan kepada-Nyalah tempat kembali dan hanya Dialah Yang Maha Kuasa atas segala sesuatu',NULL,NULL,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(35,32,'',1,'اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ وَلِلَّهِ الْحَمْدُ لَا إِلَهَ إِلَّا الله الوَاحِدُ الفَرْدُ الصَّمَدُ الَّذِي لَمْ يَتَّخِذْ صَاحِبَةً وَلَا وَلَدًا وَلَمْ يَكُنْ لَهُ شَرِيْكٌ فِي الْمُلْكِ وَلَمْ يَكُنْ لَهُ وَلِيٌّ مِنَ الذُّلِّ وَكَبِّرْهُ تَكْبِيراً. اللَّهُمَّ إِنَّكَ قُلْتَ فِي كِتَابِكَ الْمُنَزَّلِ أُدْعُوْنِي أَسْتَجِبْ لَكُمْ دَعَوْنَاكَ رَبَّنَا فَاغْفِرْلَنَا كَمَا أَمَرْتَنَا إِنَّكَ لَا تُخْلِفُ الْمِيعَادَ. رَبَّنَا إِنَّنَا سَمِعْنَا مُنَادِيًا يُنَادِي لِلْإِيْمَانِ أَنْ آمِنُوا بِرَبِّكُمْ فَأَمَنَّا . رَبَّنَا فَاغْفِرْلَنَا ذُنُوبَنَا وَكَفِّرْ عَنَّا سَيِّئَاتِنَا وَتَوَفنَّا مَعَ الأَبْرَارِ. رَبَّنَا وَآتِنَا مَا وَعَدْتَنَا عَلَى رُسُلِكَ وَلاَ تُخْزِنَا يَوْمَ القِيَامَةِ إِنَّكَ لَا تُخْلِفُ الْمِيعَادِ. رَبَّنَا عَلَيْكَ تَوَكَّلْنَا وَإِلَيْكَ أَنَبْنَا وَإِلَيْكَ الْمَصِيرُ. رَبَّنَا اغْفِرْلَنَا ذُنُوبَنَا وَلإِخْوَانِنَا الَّذِيْنَ سَبَقُوْنَا بِالْإِيْمَانِ وَلَا تَجْعَلْ فِي قُلُوْبِنَا غِلاً لِلَّذِيْنَ آمَنُوْا رَبَّنَا إِنَّكَ رَءُوْفٌ رَحِيمٌ','Allahu Akbar, Allahu Akbar, Allahu Akbar, wa lillahil-hamd. Laa ilaaha illallahul waahidul fardush-shamad, alladzii lam yattakhidz shaahibatan wa laa waladan, wa lam yakun lahuu syariikun fil-mulki, wa lam yakun lahuu waliyyun minadz- dzulli, wa kabbirhu takbiiran. Allaahumma innaka qulta fii kitaabikal-munazzal, ud\'uu- nii astajib lakum, da\'aunaaka rabbanaa faghfir lanaa, kamaa wa\'adtanaa, innaka laa tukhliful-mii\'aad. Rabbanaa innanaa sami\'naa munaadiyan yunaadii lil-iimaani an aaminuu birabbikum fa aamannaa. Rabbanaa faghfir lanna dzunuubanaa wa kaffir \'annaa sayyi-aatinaa wa thawaffanaa ma\'al-abraar. Rabbanaa wa aatinaa maa wa\'adtanaa \'alaa rusulika walaa tukhzinaa yaumal-qiyaamati, innaka laa tukhliful- mii\'aad. Rabanaa \'alaika tawakkalnaa wa ilaika anabnaa wa ilaikal-mashiir. Rabbanaghfir lanaa dzunuubanaa wa li ikhwaaninal-ladziina sabaquunaa bil- iimaani, wa laa taj\'al fi quluubinaa ghillan lilladziina aamanuu rabbanaa innaka ra- uufur-rahiim.','Allah Maha Besar. Allah Maha Besar, Allah Maha Besar, hanya bagi Allah-lah segala pujian. Tidak ada tuhan selain Allah yang Maha Esa, Tunggal, dan tempat bergantung, tidak beristeri dan tidak beranak, tidak ada sekutu dalam kekuasaan, tidak menjadi pe- lindung kehinaan. Maka agungkanlah Dia dengan se- genap kebesaran. Ya Allah, sesungguhnya Engkau telah berfirman dalam Qur\'an-Mu: \"Berdoalah kepada-Ku niscaya akan Kuperkenankan bagimu\", sekarang kami berdoa kepada-Mu wahai Tuhan kami, maka ampunilah kami sebagaimana yang telah Engkau janjikan kepada kami, sesungguhnya Engkau tidak memungkiri janji. Ya Tuhan kami, sesungguhnya kami mendengar (seruan) yang menyeru kepada iman (yaitu): \"Berimanlah kamu kepada Tuhanmu\", maka kamipun beriman. Ya Tuhan kami ampunilah bagi kami dosa-dosa kami dan hapus- kanlah dari kami kesalahan-kesalahan kami, dan wafat- kanlah kami beserta orang-orang yang berbakti. Ya Tu- han kami, berilah kami apa yang telah Engkau janjikan kepada kami dengan perantaraan rasul-rasul Engkau. Dan janganlah Engkau hinakan kami di hari Kiamat. Sesungguhnya Engkau tidak menyalahi janji. Ya Allah, hanya kepada Engkaulah kami bertawakkal, dan hanya kepada Engkaulah tempat kembali. Wahai Tuhan kami, ampunilah dosa-dosa kami dan dosa semua saudara kami seiman yang telah mendahului kami dan janganlah Engkau jadikan kedengkian dalam kalbu kami terhadap mereka yang telah beriman, wahai Tuhan kami, sesung- guhnya Engkau Maha Pengasih dan Maha Penyayang.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(36,33,'',1,'اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ وَلِلَّهِ الْحَمْدُ. رَبَّنَا أَتْمِمْ لَنَا نُوْرَنَا وَاغْفِرْلَنَا إِنَّكَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ. اللَّهُمَّ إِنِّي أَسْأَلُكَ الْخَيْرَ كُلَّهُ عَاجِلَهُ وَأَجِلَهُ وَاسْتَغْفِرُكَ لِذَنْبِي وَأَسْأَلُكَ رَحْمَتَكَ يَا أَرْحَمَ الرَّاحِمِينَ','Allaahu Akbar, Allaahu Akbar, Allaahu Akbar, wa lillaahil hamd. Rabbanaa atmim lanaa nuuranaa, waghfir lanaa, innaka \'alaa kulli syai-in qadiir. Allaahumma innii as- alukal khaira kullahu, \'aajilahu wa aajilahu, wa astaghfiruka li dzanbii, wa as\'aluka rahmataka yaa arhamar-raahimiin','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar, hanya bagi Allah segala pujian. Wahai Tuhan kami, sempurnakanlah cahaya terang bagi kami, sesungguhnya Engkau Maha Kuasa atas segala sesuatu. Ya Allah, sesungguhnya aku mohon pada-Mu segala kebaikan yang sekarang dan masa yang akan datang, dan aku mohon ampunan pada-Mu akan dosaku, serta aku mohon pada-Mu rahmat-Mu wahai Tuhan Yang Maha Pengasih dari segala yang pengasih.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(37,34,'',1,'اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ وَلِلَّهِ الْحَمْدُ اَللّٰهُمَّ إِنِّي أَسْأَلُكَ مِنْ خَيْرِ مَا تَعْلَمُ وَأَعُوْذُبِكَ مِنْ شَرِّ مَا تَعْلَمُ وَأَسْتَغْفِرُكَ مِنْ كُلِّ مَا تَعْلَمُ إِنَّكَ أَنْتَ عَلَّامُ الْغُيُوبِ. لَا إِلَهَ إِلَّا اللّٰهُ الْمُلْكُ الْحَقُّ الْمُبِينُ , مُحَمَّدٌ رَسُوْلُ اللّٰهِ صَادِقُ الْوَعْدِ الْأَمِينُ. اَللّٰهُمَّ إِنِّي أَسْأَلُكَ كَمَا هَدَيْتَنِي لِلْإِسْلَامِ أَنْ لَا تَنْزِعَهُ مِنِّي حَتَّى تَتَوَفَّنِي وَأَنَا مُسْلِمٌ ,اَللّٰهُمَّ اجْعَلْ فِي قَلْبِي نُوْرًا وَفِي سَمْعِي نُوْرًا وَفِي بَصَرِي نُوْرًا. اَللّٰهُمَّ اشْرَحْ لِي صَدْرِي وَيَسِّرْلِيْ أَمْرِي وَأَعُوْذُ بِكَ مِنْ وَسَاوِسِ الصَّدْرِ وَشَتَاتِ الْأَمْرِ وَفِتْنَةِ الْقَبْرِ. اَللّٰهُمَّ إِنِّي أَعُوْذُبِكَ مِنْ شَرِّ مَا يَلِجُ فِي اللَّيْلِ وَشَرِّ مَا يَلِجُ فِي النَّهَارِ وَمِنْ شَرِّ مَا تَهُبُّ بِهِ الرِّيَاحُ يَا أَرْحَمَ الرَّاحِمِينَ ,سُبْحَانَكَ مَا عَبَدْنَاكَ حَقَّ عِبَادَتِكَ يَا اللّٰهُ سُبْحَانَكَ مَا ذَكَرْنَاكَ حَقَّ ذِكْرِكَ يَا اللّٰه','Allaahu Akbar, Allaahu Akbar, Allaahu Akbar, wa lillaahil hamd, Allaahumma innii as\'aluka min khairi maa ta\'lamu, wa a\'uudzubika min syarri maa ta\'lamu, wa astaghfiruka min kulli maa ta\'lamu, innaka anta \'allamul ghuyuub. Laa ilaaha illallahul malikul haqqul mubiin, Muhammadur-rasuulullahish- shaadiqul wa\'dil-amiin. Allaahumma innii as\'aluka kamaa hadaitanii lil-islaam an laa tanzi\'hu minnii hattaa tathawaffaanii wa ana muslim. Allaahummaj\'al fii qalbii nuuran wa fii sam\'ii nuuran, wa fii basharii nuura. Allahummasyrah lii shadrii wa yassir lii amrii, wa a\'uudzu bika min wasaawisisha- shadri wa syataatil-amri wa fitnatil-qabri. Allaahumma innii a\'uudzu bika min syarri maa yaliju fil-laili wa syarri maa yaliju fin- nahaari, wa min syarri maa tahubbu bihir- riyaahi yaa arhamar-raahimiin. Subhaanaka maa \'abadnaaka haqqa \'ibadaatika yaa Allah, subhaanaka maa dzakarnaaka haqqa dzikrika yaa Allah','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar, hanya bagi Allah segala pujian. Ya Allah, sesungguhnya aku mohon pada-Mu dari kebaikan yang Engkau tahu, dan aku berlindung pada-Mu dari kejahatan yang Engkau tahu, dan aku mohon ampun pada-Mu dari segala kesalahan yang Engkau ketahui, sesungguhnya Engkau Maha Mengetahui yang ghaib. Tidak ada Tuhan selain Allah, Maha Raja yang sebenar- benarnya. Muhammad utusan Allah yang selalu menepati janji lagi terpercaya. Ya Allah, sebagaimana Engkau telah menunjuki aku memilih Islam, maka aku mohon pada-Mu untuk tidak mencabutnya, sehingga aku meninggal sebagai seorang muslim. Ya Allah, berilah cahaya terang dalam hati, telinga dan penglihatanku. Ya Allah, lapangkanlah dadaku dan mudahkanlah bagiku segala urusanku. Dan aku berlindung pada-Mu dari kegundahan dada dan kekacauan urusan dan fitnah kubur. Ya Allah, aku berlindung pada-Mu dari kejahatan yang tersembunyi di waktu malam dan siang hari, serta kejahatan yang dibawa angin lalu, wahai Tuhan Yang Maha Pengasih dari segenap yang pengasih. Maha Suci Engkau, kami tidak bisa menyembah-Mu dengan pengabdian semestinya, ya Allah. Maha Suci Engkau, kami tidak bisa menyebut-Mu dengan semestinya, ya Allah.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(38,35,'',1,'اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ وَلِلَّهِ الْحَمْدُ سُبْحَانَكَ مَا شَكَرْنَاكَ حَقَّ شُكْرِكَ يَا اللّٰهُ سُبْحَانَكَ مَا أَعْلَى شَأْنَكَ يَا اَللّٰهُ ,اَللَّهُمَّ حَبِّبْ إِلَيْنَا الْإِيْمَانَ وَزَيِّنْهُ فِي قلُوْبِنَا وَكَرِّهْ إِلَيْنَا الْكُفْرَ وَالْفُسُوْقَ وَالْعِصْيَانَ وَاجْعَلْنَا مِنَ الرَّاشِدِيْنَ','Allaahu Akbar Allaahu Akbar Allaahu Akbar wa lillaahil hamd. Subhaanaka maa syakarnaaka haqqa syukrika yaa Allah, subhaanaka maa a\'alaa sya\'naka yaa Allah. Allahumma habbib ilainal-iimaana wa zayyinhu fii quluubinaa, wa karrih ilainal- kufra wal-fusuuqa wal-\'ishyaan, waj\'alnaa minar-raasyidiin','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar, dan hanya bagi Allah segala pujian. Maha Suci Engkau, kami tidak mensyukuri-Mu dengan syukur yang semestinya, ya Allah. Maha Suci Engkau, alangkah Agung Zat-Mu, ya Allah. Ya Allah, cintakanlah kami kepada iman dan hiaskanlah di hati kami. Tanamkan kebencian bagi kami kepada perbuatan kufur, fasiq dan durhaka. Jadikanlah kami dari golongan orang-orang yang mendapat petunjuk.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(39,36,'',1,'اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ وَلِلّٰهِ الْحَمْدُ لَا إِلَهَ إِلَّا اللّٰهُ وَحْدَهُ صَدَقَ وَعْدَهُ وَنَصَرَ عَبْدَهُ وَهَزَمَ الْأَحْزَابَ وَحْدَهُ لَا إِلَهَ إِلَّا اللّٰهُ وَلَا نَعْبُدُ إِلَّا إِيَّاهُ مُخْلِصِينَ لَهُ الدِّيْنَ وَلَوْ كَرِهَ الْكَافِرُوْنَ. اَللّٰهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى اَللّٰهُمَّ لَكَ الْحَمْدُ كَالَّذِي نَقُوْلُ وَخَيْرًا مِمَّا نَقُوْلُ اَللّٰهُمَّ إِنِّي أَسْأَلُكَ رِضَاكَ وَالْجَنَّةَ وَأَعُوْذُبِكَ مِنْ سَخَطِكَ وَالنَّارِ وَمَا يُقَرِّبُنِي إِلَيْهَا مِنْ قَوْلٍ أَوْ فِعْلٍ أَوْ عَمَلٍ. اَللّٰهُمَّ بِنُوْرِكَ اهْتَدَيْنَا وَبِفَضْلِكَ اسْتَغْنَيْنَا وَفِي كَنَفِكَ وَإِنْعَامِكَ وَعَطَائِكَ وَإِحْسَانِكَ أَصْبَحْنَا وَأَمْسَيْنَا أَنْتَ الْأَوَّلُ فَلَا قَبْلَكَ شَيْءٌ وَالْآخِرُ فَلَا بَعْدَكَ شَيْءٌ وَالظَّاهِرُ فَلَا شَيْئً فَوْقَكَ وَالْبَاطِنُ فَلَا شَيْئَ دُوْنَكَ نَعُوْذُبِكَ مِنَ الْفَلَسِ أَوِ الْكَسَلِ وَعَذَابِ الْقَبْرِ وَفِتْنَةِ الْغِنَى وَنَسْأَلُكَ الْفَوْزَ بِالْجَنَّةِ','Allaahu akbar, Allaahu akbar, Allaahu akbar, wa lillaahil hamd, laa ilaaha illallaahu wahdahu, shadaqa wa\'dahu, wanashara \'abdahu, wahazamal ahzaaba wahdahu, laa ilaaha illallaahu walaa na\'budu illaa iyyaahu, mukhlishiina lahud- diina walau karihal kaafiruun. Allaahumma innii as-alukal hudaa wat- tuqaa wal-\'afaafa wal-ghinaa. Allaahumma lakal hamdu kalladzii naquulu wa khairan mimmaa naquulu. Allaahumma innii as-aluka ridhaaka wal jannata, wa a\'uudzu bika min sakhathika wan-naari, wamaa yuqarribunii ilaihaa min qaulin au fi\'lin au \'amalin. Allaahumma binuurikahtadainaa wabi- fadhlikastaghnainaa wafii kanafika wa- in\'aamika wa \'athaa-ika wa ihsaanika ashbahnaa wa amsainaa antal awwalu falaa qablaka syai-un wal-aakhiru falaa ba\'daka syai-un wazh-zhaahiru falaa syai-a fauqaka wal baathinu falaa syai-a duunaka na\'uudzu bika minal falasi wal kasali wa \'adzaabal qabri wa fitnatil ghinaa wanas- alukal fauza bil-jannah','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar. Segala puji hanya untuk Allah. Tidak ada Tuhan selain Allah Yang Maha Esa, yang menepati janji- Nya, menolong hamba-Nya dan mengalahkan sendiri musuh-musuh-Nya. Tiada Tuhan selain Allah. Dan kami tidak menyembah selain Dia dengan memurnikan kepatuhan kepada-Nya, sekalipun orang-orang kafir membenci. Ya Allah, aku memohon pada-Mu petunjuk, ketakwaan, pengendalian diri dan kekayaan. Ya Allah, pada-Mu-lah segala puji seperti yang kami ucapkan. Ya Allah, aku mohon pada-Mu ridha-Mu dan surga, aku berlindung pada-Mu dari murka-Mu dan siksa neraka dan apapun yang mendekatkan aku padanya (neraka), baik ucapan ataupun amal perbuatan. Ya Allah, hanya dengan nur cahaya-Mu kami ini mendapat petunjuk, dengan pemberian-Mu kami merasa cukup, dan dalam naungan-Mu, nikmat-Mu, anugerah-Mu dan kebajikan- Mu jualah kami ini berada di waktu pagi dan petang. Engkau-lah yang mula pertama, tidak ada sesuatu pun yang ada sebelum-Mu dan Engkau pulalah yang paling akhir dan tidak ada sesuatu pun yang ada di belakang (sesudah)-Mu, Engkaulah yang lahir (nyata), maka tidak ada sesuatu pun yang di atas Engkau. Engkau pulalah yang batin, maka tidak ada sesuatupun di bawah-Mu. Kami berlindung pada-Mu dari pailit, malas, siksa kubur dan fitnah kekayaan serta kami mohon pada-Mu kemenangan memperoleh surga.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(40,37,'',1,'اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ كَبِيرًا وَالْحَمْدُ لِلَّهِ كَثِيرًا. اَللّٰهُمَّ حَبِّبْ إِلَيَّ الْإِيْمَانَ وَزَيِّنْهُ فِي قَلْبِي وَكَرِّهْ إِلَيَّ الْكُفْرَ وَالْفُسُوْقَ وَالْعِصْيَانَ وَاجْعَلْنِي مِنَ الرَّاشِدِينَ','Allaahu akbar, Allaahu akbar, Allaahu akbar kabiiran walhamdu lillaahi katsiiraa. Allaahumma habbib ilayyal iimaana wa zayyinhu fii qalbii wa karrih ilayyal kufra wal fusuuqa wal-\'ishyaana waj\'alnii minar-raasyidiin','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar. Segala puji bagi Allah dengan pujian yang tidak terhingga. Ya Allah, cintakanlah aku kepada iman dan hiaskanlah ia di kalbuku. Tanamkanlah kebencian padaku perbuatan kufur, fasiq dan durhaka. Dan jadikanlah pula aku dari golongan orang yang mendapat petunjuk.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(41,38,'',1,'رَبِّ اغْفِرْ وَارْحَمْ وَاعْفُ وَتَكَرَّمْ وَتَجَاوَزْ عَمَّا تَعْلَمُ إِنَّكَ تَعْلَمُ مَا لَا نَعْلَمُ إِنَّكَ أَنْتَ اللّٰهُ الْأَعَزُّ الْأَكْرَمُ','Rabbighfir, warham, wa\'fu, wa takarram, wa tajaawaz, \'ammaa ta\'lamu, innaka ta\'lamu, maa laa na\'lamu, innaka antallaahu al a’azzul akram','Ya Allah ampunilah, sayangilah, maafkanlah, bermurah hatilah dan hapuskanlah apa-apa yang Engkau ketahui. Sesungguhnya Engkau Maha Mengetahui apa- apa yang kami sendiri tidak tahu. Sesungguhnya Engkau ya Allah Maha Mulia dan Maha Pemurah.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(42,39,'',1,'إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَائِرِ اللّٰهِ. فَمَنْ حَجَّ الْبَيْتَ أَوِعْتَمَرَ فَلَا جُنَاحَ عَلَيْهِ أَنْ يَطَوَّفَ بِهِمَا وَمَنْ تَطَوَّعَ خَيْرًا فَإِنَّ اللّٰهَ شَاكِرٌ عَلِيْمٌ','Innash shafaa wal-marwata min sya\'aa- irillaahi, faman hajjal baita awi\'tamara falaa junaaha \'alaihi an yaththawwafa bihimaa wa man tathawwa\'a khairan fa- innallaaha syaakirun \'aliim.','Sesungguhnya Shafa dan Marwah sebagian dari syiar-syiar (tanda kebesaran) Allah. Maka barangsiapa yang beribadah haji ke Baitullah ataupun berumrah, maka tidak ada dosa baginya berkeliling (mengerjakan sa\'i antara keduanya). Dan barangsiapa mengerjakan sesuatu kebajikan dengan kerelaan hati, maka sesungguhnya Allah Maha Menerima Kebaikan lagi Maha Mengetahui.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(43,40,'',1,'اَللّٰهُمَّ رَبَّنَا تَقَبَّلْ مِنَّا وَعَافِنَا وَاعْفُ عَنَّا وَعَلَى طَاعَتِكَ وَشُكْرِكَ أَعِنَّا وَعَلَى غَيْرِكَ لَا تَكِلْنَا وَعَلَى الْإِيْمَانِ وَالْإِسْلَامِ الْكَامِلِ جَمِيعًا تَوَفَّنَا وَأَنْتَ رَاضٍ عَنَّا اَللّٰهُمَّ ارْحَمْنِي بِتَرْكِ الْمَعَاصِي أَبَدًا مَا أَبْقَيْتَنِي وَارْحَمْنِيْ أَنْ تَكَلَّفَ مَا لَا يَعْنِينِي وَارْزُقْنِي حُسْنَ النَّظَرِ فِيمَا يُرْضِيْكَ عَنِّي يَا أَرْحَمَ الرَّاحِمِينَ','Allaahumma rabbanaa taqabbal minnaa wa \'aafinaa, wa\'fu \'annaa, wa \'alaa thaa\'atika wasyukrika a\'innaa wa \'alaa ghairika laa takilnaa, wa \'alal iimaani wal- islaamil kaamili jamii\'an thawaffanaa, wa anta raadhin \'annaa. Allaahummarhamnii bitarkil ma\'aashii \'abadan maa abqaitanii warhamnii an atakallafa maa laa ya\'niinii warzuqnii husnun-nazhari fiimaa yurdhiika \'annii yaa arhamar raahimiin.','Ya Allah ya Tuhan kami, terimalah amalan kami, berilah perlindungan kepada kami, maafkanlah kesalahan kami dan berilah pertolongan kepada kami untuk taat dan bersyukur kepada-Mu. Janganlah Engkau jadikan kami bergantung selain kepada-Mu. Matikanlah kami dalam iman dan Islam secara sempurna dalam keridhaan-Mu. Ya Allah rahmatilah kami sehingga mampu meninggalkan segala kejahatan selama hidup kami, dan rahmatilah kami sehingga tidak berbuat hal yang tidak berguna. Karuniakanlah kepada kami sikap pandang yang baik terhadap apa-apa yang membuat-Mu ridha terhadap kami. Wahai Tuhan Yang Maha Pengasih dari segala yang pengasih.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(44,41,'',1,'اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ اَللّٰهُ أَكْبَرُ. اَلْحَمْدُ لِلَّهِ عَلَى مَا هَدَانَا وَالْحَمْدُ لِلَّهِ عَلَى مَا أَنْعَمَنَا بِهِ عَلَيْنَا اَللّٰهُمَّ هٰذِهِ نَاصِيَتِي فَتَقَبَّلْ مِنِّي وَاغْفِرْ ذُنُوْبِي. اَللّٰهُمَّ اغْفِرْ لِلْمُحَلِّقِينَ وَالْمَقْصُورِيْنَ يَا وَاسِعَ الْمَغْفِرَةِ. اَللّٰهُمَّ اُثْبُتْ لِي بِكُلِّ شَعْرَةٍ حَسَنَةً وَامْحُ عَنِّي بِهَا سَيِّئَةً, وَارْفَعْ لِيْ بِهَا عِنْدَكَ دَرَجَةً','Allaahu akbar Allaahu akbar Allaahu akbar. Alhamdu lillaahi \'alaa maa hadaanaa walhamdu lillaahi \'alaa maa an\'amanaa bihi \'alainaa. Allaahumma haadzihi naashibatii fataqabbal minnii waghfir dzunuubii. Allaahummaghfir lil muhalliqiina wal maqshuuriina yaa waasi\'al maghfirah. Allaahummatsbut lii bikulli sya\'ratin wa hasanatan wamhu \'annii bihaa sayyi-atan. Warfa\' lii bihaa indaka darajah','Allah Maha Besar, Allah Maha Besar, Allah Maha Besar. Segala puji bagi Allah yang telah memberi petunjuk kepada kita dan segala puji bagi Allah tentang apa-apa yang telah Allah karuniakan kepada kami. Ya Allah, ini ubun-ubunku, maka terimalah dariku (amal perbuatanku) dan ampunilah dosa-dosaku. Ya Allah, ampunilah orang-orang yang mencukur dan memendekkan rambutnya wahai Tuhan yang Maha Luas ampunan-Nya. Ya Allah, tetapkanlah untuk diriku setiap helai rambut kebajikan dan hapuskanlah untukku dengan setiap helai rambut kejelekan. Dan angkatlah derajatku di sisi-Mu',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(45,42,'',1,'الْحَمْدُ لِلَّهِ الَّذِي قَضَى عَنَّا مَنَاسِكَنَا اللَّهُمَّ زِدْنَا إِيْمَانًا وَيَقِينًا وَعَوْنًا وَاغْفِرْ لَنَا وَلِوَالِدَيْنَ وَلِسَائِرِ الْمُسْلِمِينَ وَالْمُسْلِمَاتِ','Alhamdu lillaahil ladzii qadhaa \'annaa ma- naasikanaa. Allaahumma zidnaa iimaanan wa yaqiinan wa \'aunan waghfir lanaa wa liwaalidainaa walisaa-iril muslimiina wal muslimaat.','Segala puji bagi Allah yang telah menyelesaikan manasik kami. Ya Allah tambahkanlah kepada kami iman, keyakinan, pertolongan dan ampunilah kami, kedua orang tua kami serta seluruh kaum muslimin dan muslimat.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(46,43,'',1,'اللّهُمَّ إِلَيْكَ تَوَجَّهْتُ وَإِلَى وَجْهِكَ الْكَرِيْمِ اَرَدْتُ فَاجْعَلْ ذَنْبِيْ مَغْفُوْرًا وَحَجِّيْ مَبْرُوْرًا وَارْحَمْنِيْ وَلاَ تُخَيِّبْنِيْ إِنَّكَ عَلَى كُلِّ شَيْءٍ قَدِيْرٌ','Allahumma ilaika tawajjahtu wa ilaa wajhikal karim aradtu faj’al dzanbi maghfuuran, wajji mambruuran, warhamni wala tukhayyibni innaka ala kulli syaiin qadir.','Ya Allah, hanya kepada-Mu aku menghadap dan terhadapmu-Mu Tuhan Yang Pemurah aku mengharap, maka jadikan dosaku terampuni, hajiku diterima, sayangilah aku dan jangan permalukan. Sungguh Engkau Maha Kuasa atas segala sesuatu.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(47,44,'',1,'اللَّهُمَّ إِلَيْكَ تَوَجَّهْتُ، وَبِكَ اعْتَصَمْتُ، وَعَلَيْكَ تَوَكَّلْتُ . اللَّهُمَّ اجْعَلْنِيْ مِمَّنْ تُبَاهِيْ بِهِ اليَوْمَ مَلاَئِكَتَكَ، إِنَّكَ عَلَى كُلِّ شَيْءٍ قَدِيْرٌ','Allahumma ilaika tawajjahtu, wabika’tashamtu, wa’alaika tawakkaltu. Allahummaj’alniiy mimmantubaahiiy bihilyauma malaa ikataka, innaka ‘alaa kulla sya’in qadiirun','Ya Allah, hanya kepada Engkaulah aku menghadap, dengan Engkaulah aku berpegang teguh, pada Engkaulah aku berserah diri. Ya Allah, jadikanlah aku di antara orang yang hari ini Engkau banggakan di hadapan Malaikat-Mu, sesungguhnya Engkau Maha Kuasa atas segala sesuatu.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(48,45,'',1,'لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ يُحْيِي وَيُمِيْتُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ','Laa ilaaha illallaah wahdahu laa syariika lah lahul mulku wa lahul hamdu yuhyii wa yumiitu wa huwa \'ala kulli syai-in qadiir','Tidak ada Tuhan selain Allah, Zat yang Esa dan tidak ada sekutu bagi-Nya. Bagi-Nya segala kerajaan dan segala pujian. Di tangan-Nya-lah segala kebaikan dan Dia Mahakuasa atas segala sesuatu.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(49,46,'',1,'اَللّٰهُمَّ إِنَّ هٰذِهِ مُزْدَلِفَةُ جُمِعَتْ فِيْهَا أَلْسِنَةٌ مُخْتَلِفَةٌ تَسْأَلُكَ حَوَائِجَ مُتَنَوِّعَةً فَاجْعَلْنِيْ مِمَّنْ دَعَاكَ فَاسْتَجَبْتَ لَهُ وَتَوَكَّلَ عَلَيْكَ فَكَفَيْتَهُ يَا أَرْحَمَ الرَّاحِمِيْنَ','Allaahumma inna hadzihi muzdalifatu jumi\'at fiihaa alsinatun mukhtalifatun, tas aluka hawaa ija mutanawwi \'atan faj\'alnii mimman da\'aaka fastajabta lahu watawakkala \'alaika fakafaitahu yaa arhamarraahimiin.','Ya Allah, sesungguhnya ini Muzdalifah telah berkumpul bermacam-macam bahasa yang memohon kepada-Mu keperluan yang beraneka ragam, maka masukkanlah aku ke dalam golongan orang yang memohon kepada-Mu, lalu Engkau penuhi permintaannya, yang berserah diri pada-Mu, lalu Engkau lindungi dia, wahai Tuhan Yang Maha Pengasih.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(50,47,'',1,'اَللّٰهُمَّ إِنِّي أَسْأَلُكَ أَنْ تَرْزُقَنِي فِي هٰذَا الْمَكَانِ جَوامِعَ الْخَيْرِ كُلِّهِ وَأَنْ تُصْلِحَ شَأْنِيْ كُلَّهُ, وَأَنْ تَصْرِفَ عَنِّي الشَّرَّ كُلَّهُ فَإِنَّهُ لَا يَفْعَلُ ذَلِكَ غَيْرُكَ وَلَا يَجُودُ بِهِ إِلَّا أَنْتَ','Allaahumma innii as-aluka an tarzuqanii fii haadzal makaani jawaami\'al khairi kullihii, wa anttushliha sya\'nii kullahu wa antashrifa \'annisy-syarra kullahu, fa innahu laa yafʼalu dzaalika ghairuka, walaa yajuudu bihi illaa anta','Ya Allah, sungguh aku memohon kepada-Mu, supaya Engkau menganugerahkan rezeki kepadaku dalam tempat ini berupa segala ben- tuk kebaikan supaya Engkau memperbaiki keadaanku seluruhnya dan menghilangkan dariku segala bentuk keburukan, karena tidak ada yang mampu melakukan selain Engkau dan tidak ada yang dapat memberikan-nya selain Engkau.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(51,48,'',1,'اللَّهُمَّ هٰذِهِ مِنٰي فَامْنُنْ عَلَيَّ بِمَا مَنَنْتَ بِهِ عَلَى أَوْلِيَائِكَ وَأهْلِ طَاعَتِكَ','Allahumma haadzihi minaa famnun \'alayya bimaaa mananta bihi \'ala auliyaa-ika wa ahli thaa-atika','Ya Allah, tempat ini adalah Mina, maka anugerahilah aku apa yang telah Engkau anugerahkan kepada orang-orang yang dekat dan taat kepada-Mu.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(52,49,'',1,'اَلْحَمْدُ لِلّٰهِ الَّذِي بَلَغَنِيْهَا سَالِمًا مُعَافًا, اَللّٰهُمَّ هٰذِهِ مِنٰى قَدْ أَتَيْتُهَا, وَأَنَا عَبْدُكَ, وَفِي قَبْضَتِكَ أَسْأَلُكَ أَنْ تَمُنَّ عَلَيَّ بِمَا مَنَنْتَ بِهِ عَلَى أَوْلِيَائِكَ, اَللّٰهُمَّ إِنِّي أَعُوْذُ بِكَ مِنَ الْحِرْمَانِ وَالْمُصِيْبَةِ فِي دِيْنِي يَا أَرْحَمَ الرَّاحِمِيْنَ','Alhamdulillaahilladzii balaghaniihaa saaliman mu’aafan Allaahumma haadzihi minaa qad ataituhaa wa anaa ‘abduka wafii qabdhatika as-aluka an-tamunna ‘alayya bimaa mananta bihi ‘alaa auliyaaika Allaahumma innii a’uudzubika minalhirmaani walmushiibati fii diinii yaa arhamarraahimiin.','Segala puji bagi Allah yang telah menyampaikan aku ke sini (Mina) dengan selamat dan sehat. Ya Allah, inilah tempat bernama Mina, aku datang ke tempat ini sedang aku adalah hamba-Mu dan dalam genggaman-Mu. Aku memohon kepada-Mu, berilah aku nikmat sebagaimana nikmat yang Engkau berikan kepada kekasih-kekasih-Mu. Ya Allah, aku berlindung kepada-Mu dari terhalang rahmat-Mu dan dari musibah pada agamaku, ya Allah, Yang Maha Pengasih dari segala Yang Pengasih',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(53,50,'',1,'بِسْمِ اللّٰهِ اَللّٰهُ أَكْبَرُ رَجْمًا لِلشَّيَاطِينِ وَرِضًا لِلرَّحْمٰنِ. اَللّٰهُمَّ اجْعَلْ حَجًّا مَبْرُوْرًا وَسَعْيًا مَشْكُورًا','Bismillaahi Allaahu Akbar rajman lissyayaathiina waridhan lirrahmaani Allaahummaj’al hajjan mab- ruuraa wasa’yan masykuura','Dengan nama Allah, Allah Maha Besar, kutukan bagi segala setan dan rida bagi Allah Yang Maha Pengasih, Ya Allah Tuhanku, jadikanlah ibadah hajiku ini haji yang mabrur dan sa \'i yang diterima',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(54,51,'',1,'اَلْحَمْدُ لِلَّهِ حَمْدًا كَثِيرًا طَيِّبًا مُبَارَكًا فِيْهِ . اَللّٰهُمَّ لَا أُحْصِي ثَنَاءً عَلَيْكَ أَنْتَ كَمَا أَثْنَيْتَ عَلَى نَفْسِكَ. اَللّٰهُمَّ إِلَيْكَ أَفَضْتُ وَمِنْ عَذَابِكَ أَشْفَقْتُ وَإِلَيْكَ رَغِبْتُ وَمِنْكَ رَهِبْتُ فَاقْبَلْ نُسُكِي وَأَعْظِمْ أَجْرِي وَارْحَمْ تَضَرُّعِي وَاقْبَلْ تَوْبَتِي وَأَقِلَّ عَثْرَتِي وَاسْتَجِبْ دَعْوَتِي وَأَعْطِنِي سُؤْلِي. اَللّٰهُمَّ رَبَّنَا تَقَبَّلْ مِنَّا وَلَا تَجْعَلْنَا مِنَ الْمُجْرِمِينَ, وَأَدْخِلْنَا فِي عِبَادِكَ الصَّالِحِينَ يَا أَرْحَمَ الرَّاحِمِينَ','Alhamdulillaahi hamdan kastiiran thayyiban mubaarakan fiih. Allaahumma laa uhshii tsanaa an ‘alaika anta kamaa atsnaita ‘alaa nafsika. Allaahumma ilaika afadhtu wa min ‘adzaabika asyfaqtu wa ilaika raghibtu waminka rahibtu faqbal nusukii wa a’dzhim ajrii warham tadharru’ii waqbal taubatii wa aqilla  ‘atsratii wastajib da’watii wa a’thinii su’lii. Allaahumma robbanaa taqabbal minnaa walaa taj’alnaa minal mujrimiina wa adkhilnaa fii ‘ibaadikashaalihiina ya arhamarraahimiina','Segala puji bagi Allah, pujian yang banyak lagi baik dan membawa berkat di dalamnya. Ya Allah, sekali-kali kami tidak mampu men- cakup (segala macam) pujian untuk-Mu, sesuai pujianMu atas diri-Mu. Ya Allah, ha- nya kepada-Mu aku berserah, dari siksa-Mu aku mohon belas kasihan, dan kepada-Mu lah aku berharap dan aku takut, maka teri- malah ibadahku, perbesarlah pahalaku, kasi- hanilah kerendahan hatiku, terimalah tau- batku, perkecillah kekeliruanku perkenan- kanlah permohonanku dan berikanlah per- mintaanku. Ya Allah kabulkanlah, terimalah persembahan kami ini dan janganlah kami dijadikan orang-orang yang berdosa, tetapi masukkanlah kami dalam hamba-Mu yang saleh wahai Tuhan Yang Paling Pengasih.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(55,52,'',1,'اَللَّهُمَّ هٰذَا حَرَمُ رَسُولِكَ. فَاجْعَلْهُ وِقَايَةً لِي مِنَ النَّارِ وَأَمَانَةً مِنَ الْعَذَابِ وَسُوءِ الْحِسَابِ','Allâhumma hâdzâ haramu rasûlika, faj\'alhu li wiqâyatan minan nâri, wa amanan minal adzabi wa súil hisabi','Ya Allah ini adalah tempat suci Rasul-Mu. Tolong jadikan ia sebagai pelindungku dari jilatan api neraka dan sebagai pengaman dari siksa hisab yang buruk',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(56,53,'',1,'أَعُوْذُ بِا للّٰهِ الْعَظِيْمِ وَبِوَجْهِهِ الْكَرِيْمِ وَسُلْطَانِهِ الْقَدِيْمِ مِنَ الشَّيْطَانِ الرَّجِيْمِ. بِسْمِ للّٰهِ وَالْحَمْدُ لِلهِ. أَللّٰهُمَّ صَلِّ وَسَلِّمْ عَلَى سَيِّدِنَا مُحَمَّدٍ وَعَلَى آلِ سَيِّدِنَا مُحَمَّدٍ. اَللَّهُمَّ اغْفِرْ لِي ذُنُوْبِي وَافْتَحْ لِي أَبْوَابَ رَحْمَتِكَ','A\'udzu billahil-\'azhimi wa bi wajhihil-karimi wa sulthanihil-qadimi min asy-syaithani ar-rajimi, bismillahi Allahumma shalli \'ala Muhammadin wa alihi wa sallim. Allahumma igfir li dzunubi wa-ftah li abwaba rahmatika','Hamba berlindung kepada Allah yang Maha Agung, kepada wajah-Nya yang Mulia, dan kepada kekuasaan-Nya yang Mahadahulu, dari setan yang terkutuk. Dengan menyebut nama Allah; ya Allah, curahkanlah shalawat dan salam kepada Muhammad beserta keluarga Beliau. Ya Allah, ampunilah dosa-dosa hamba dan bukakanlah pintu-pintu rahmat-Mu untuk hamba',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(57,54,'',1,'اللَّهُمَّ بَارِكْ لَنَا فِيمَا رَزَقْتَنَا وَقِنَا عَذَابَ النَّارِ','Allahumma baarik lanaa fiimaa razaqtanaa wa qinaa \'adzaaban naar.','Ya Allah, berkahilah kami atas rezeki yang telah Engkau anugerahkan kepada kami dan peliharalah kami dari siksa neraka.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(58,55,'',1,'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ','Alhamdu lillahil ladzii ath\'amanaa wa saqaanaa wa ja\'alanaa muslimiin.','Segala puji bagi Allah yang telah memberi kami makan dan minum serta menjadikan kami termasuk golongan orang-orang muslim.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09'),(59,56,'',1,'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ','Subhaanalladzii sakhkhara lanaa haadzaa wa maa kunnaa lahu muqriniina wa innaa ilaa rabbinaa lamunqalibuun.','Maha Suci Allah yang telah menundukkan semua ini bagi kami padahal kami sebelumnya tidak mampu menguasainya, dan sesungguhnya kami akan kembali kepada Tuhan kami.',NULL,NULL,'2026-10-01 02:14:09','2026-10-01 02:14:09');
/*!40000 ALTER TABLE `doa_item` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doa_kategori`
--

DROP TABLE IF EXISTS `doa_kategori`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `doa_kategori` (
  `id_kategori` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_ta` bigint(20) unsigned DEFAULT NULL,
  `nama_kategori` varchar(255) NOT NULL,
  `slug_kategori` varchar(255) NOT NULL,
  `icon_key` varchar(255) DEFAULT NULL,
  `color_hex` varchar(20) DEFAULT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_kategori`),
  UNIQUE KEY `doa_kategori_id_ta_slug_kategori_unique` (`id_ta`,`slug_kategori`),
  CONSTRAINT `doa_kategori_id_ta_foreign` FOREIGN KEY (`id_ta`) REFERENCES `travel_agent` (`id_ta`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doa_kategori`
--

LOCK TABLES `doa_kategori` WRITE;
/*!40000 ALTER TABLE `doa_kategori` DISABLE KEYS */;
INSERT INTO `doa_kategori` VALUES (1,NULL,'Umrah Depag','umrahDepag',NULL,NULL,0,1,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(2,NULL,'Umrah Umum','umrahUmum',NULL,NULL,0,1,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(3,NULL,'Haji','haji',NULL,NULL,0,1,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(4,NULL,'Thawaf','thawaf',NULL,NULL,0,1,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(5,NULL,'Sai','sai',NULL,NULL,0,1,'2026-10-01 02:14:08','2026-10-01 02:14:08'),(6,NULL,'Lainnya','other',NULL,NULL,0,1,'2026-10-01 02:14:08','2026-10-01 02:14:08');
/*!40000 ALTER TABLE `doa_kategori` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `draft_jamaah_batchroom`
--

DROP TABLE IF EXISTS `draft_jamaah_batchroom`;
/*!50001 DROP VIEW IF EXISTS `draft_jamaah_batchroom`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `draft_jamaah_batchroom` AS SELECT
 1 AS `id_jamaah`,
  1 AS `nama_jamaah`,
  1 AS `nomor_telepon`,
  1 AS `jamaah_created_at`,
  1 AS `jamaah_is_active`,
  1 AS `tanggal_kepulangan`,
  1 AS `nama_batch`,
  1 AS `id_batch_room`,
  1 AS `id_batch` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `ems_log`
--

DROP TABLE IF EXISTS `ems_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ems_log` (
  `id_ems_log` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_ems_master` bigint(20) unsigned NOT NULL,
  `tanggal` date NOT NULL,
  `waktu` time NOT NULL,
  `tindakan` text NOT NULL,
  `latitude` text NOT NULL,
  `longitude` text NOT NULL,
  `photo` text NOT NULL COMMENT 'Image Path is point to public/storage/ems/log',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_ems_log`),
  KEY `ems_log_id_ems_master_foreign` (`id_ems_master`),
  CONSTRAINT `ems_log_id_ems_master_foreign` FOREIGN KEY (`id_ems_master`) REFERENCES `ems_master` (`id_ems_master`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ems_log`
--

LOCK TABLES `ems_log` WRITE;
/*!40000 ALTER TABLE `ems_log` DISABLE KEYS */;
INSERT INTO `ems_log` VALUES (1,1,'2026-10-01','08:44:00','Sinyal darurat SOS diterima oleh sistem. Koordinat GPS terakhir terdeteksi di Marwah Lt 2.','21.4239000','39.8278000','','2026-10-01 01:44:00','2026-10-01 01:44:00'),(2,1,'2026-10-01','09:09:00','Ustadz Muthawif dan Tour Leader sedang menuju lokasi koordinat radar.','21.4235000','39.8271000','','2026-10-01 02:09:00','2026-10-01 02:09:00'),(3,2,'2026-09-30','15:15:00','Jamaah berhasil ditemukan dalam kondisi sehat oleh petugas Tour Leader dan telah kembali ke rombongan.','21.4201000','39.8248000','67abec','2026-09-30 02:29:00','2026-09-30 02:29:00');
/*!40000 ALTER TABLE `ems_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ems_master`
--

DROP TABLE IF EXISTS `ems_master`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ems_master` (
  `id_ems_master` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tanggal_kejadian` date NOT NULL,
  `waktu_kejadian` time NOT NULL,
  `tanggal_close` date DEFAULT NULL,
  `waktu_close` time DEFAULT NULL,
  `id_ems` bigint(20) unsigned NOT NULL,
  `lat_kejadian` text NOT NULL,
  `long_kejadian` text NOT NULL,
  `deskripsi` text NOT NULL,
  `photo` text DEFAULT NULL COMMENT 'Image Path is point to public/pictures/ems/master',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `is_found` tinyint(1) NOT NULL DEFAULT 0,
  `id_jamaah` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id_ems_master`),
  KEY `ems_master_id_ems_foreign` (`id_ems`),
  KEY `ems_master_id_jamaah_foreign` (`id_jamaah`),
  KEY `ems_master_is_found_index` (`is_found`),
  CONSTRAINT `ems_master_id_ems_foreign` FOREIGN KEY (`id_ems`) REFERENCES `m_es_code` (`id_ems`),
  CONSTRAINT `ems_master_id_jamaah_foreign` FOREIGN KEY (`id_jamaah`) REFERENCES `jamaah` (`id_jamaah`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ems_master`
--

LOCK TABLES `ems_master` WRITE;
/*!40000 ALTER TABLE `ems_master` DISABLE KEYS */;
INSERT INTO `ems_master` VALUES (1,'2026-10-01','09:29:00',NULL,NULL,1,'21.4239000','39.8278000','Jamaah lansia terpisah dari rombongan saat prosesi Sa\'i di Marwah lantai 2. Smartwatch mengirimkan sinyal SOS otomatis.','','2026-10-01 01:44:00','2026-10-01 02:19:00',0,13),(2,'2026-09-30','14:20:00','2026-09-30','15:15:00',1,'21.4201000','39.8248000','Jamaah tertinggal di area plaza King Fahd Gate seusai Shalat Dzuhur berjamaah.','67abec','2026-09-30 02:29:00','2026-09-30 02:29:00',1,14);
/*!40000 ALTER TABLE `ems_master` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `family_tracking_codes`
--

DROP TABLE IF EXISTS `family_tracking_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `family_tracking_codes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(255) NOT NULL,
  `id_jamaah` bigint(20) unsigned NOT NULL,
  `id_ta` bigint(20) unsigned NOT NULL,
  `valid_until` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `family_tracking_codes_code_unique` (`code`),
  KEY `family_tracking_codes_id_jamaah_foreign` (`id_jamaah`),
  KEY `family_tracking_codes_id_ta_foreign` (`id_ta`),
  CONSTRAINT `family_tracking_codes_id_jamaah_foreign` FOREIGN KEY (`id_jamaah`) REFERENCES `jamaah` (`id_jamaah`) ON DELETE CASCADE,
  CONSTRAINT `family_tracking_codes_id_ta_foreign` FOREIGN KEY (`id_ta`) REFERENCES `travel_agent` (`id_ta`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `family_tracking_codes`
--

LOCK TABLES `family_tracking_codes` WRITE;
/*!40000 ALTER TABLE `family_tracking_codes` DISABLE KEYS */;
INSERT INTO `family_tracking_codes` VALUES (1,'JKM9A2X1',13,14,'2026-10-31 09:29:00','2026-10-01 02:29:00','2026-10-01 02:29:00'),(2,'SAFF7788',14,14,'2026-10-31 09:29:00','2026-10-01 02:29:00','2026-10-01 02:29:00'),(3,'UMR2026A',15,14,'2026-10-31 09:29:00','2026-10-01 02:29:00','2026-10-01 02:29:00'),(4,'TRACK999',16,14,'2026-10-31 09:29:00','2026-10-01 02:29:00','2026-10-01 02:29:00'),(5,'PILGRIM1',17,14,'2026-10-31 09:29:00','2026-10-01 02:29:00','2026-10-01 02:29:00');
/*!40000 ALTER TABLE `family_tracking_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `feedback_jamaah`
--

DROP TABLE IF EXISTS `feedback_jamaah`;
/*!50001 DROP VIEW IF EXISTS `feedback_jamaah`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `feedback_jamaah` AS SELECT
 1 AS `id`,
  1 AS `nama_jamaah`,
  1 AS `nama_travel_agent`,
  1 AS `comments`,
  1 AS `rating`,
  1 AS `created_at`,
  1 AS `updated_at` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `file_pesan`
--

DROP TABLE IF EXISTS `file_pesan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `file_pesan` (
  `id_file_pesan` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `path_file` text NOT NULL,
  `id_broadcast` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `nama_file` text DEFAULT NULL COMMENT 'Original File Name',
  PRIMARY KEY (`id_file_pesan`),
  KEY `file_pesan_id_broadcast_foreign` (`id_broadcast`),
  CONSTRAINT `file_pesan_id_broadcast_foreign` FOREIGN KEY (`id_broadcast`) REFERENCES `broadcast_pesan` (`id_broadcast`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `file_pesan`
--

LOCK TABLES `file_pesan` WRITE;
/*!40000 ALTER TABLE `file_pesan` DISABLE KEYS */;
/*!40000 ALTER TABLE `file_pesan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gps_jamaah`
--

DROP TABLE IF EXISTS `gps_jamaah`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `gps_jamaah` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_jamaah` bigint(20) unsigned NOT NULL,
  `id_gps` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `gps_jamaah_id_jamaah_foreign` (`id_jamaah`),
  KEY `gps_jamaah_id_gps_foreign` (`id_gps`),
  CONSTRAINT `gps_jamaah_id_gps_foreign` FOREIGN KEY (`id_gps`) REFERENCES `device_gps` (`id_gps`) ON DELETE CASCADE,
  CONSTRAINT `gps_jamaah_id_jamaah_foreign` FOREIGN KEY (`id_jamaah`) REFERENCES `jamaah` (`id_jamaah`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gps_jamaah`
--

LOCK TABLES `gps_jamaah` WRITE;
/*!40000 ALTER TABLE `gps_jamaah` DISABLE KEYS */;
INSERT INTO `gps_jamaah` VALUES (9,13,9,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(10,14,10,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(11,15,11,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(12,16,12,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(13,17,13,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(14,18,14,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(15,19,15,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(16,20,16,'2026-10-01 02:34:49','2026-10-01 02:34:49');
/*!40000 ALTER TABLE `gps_jamaah` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `help_documents`
--

DROP TABLE IF EXISTS `help_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `help_documents` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `singleton_key` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `title` varchar(255) NOT NULL DEFAULT 'Panduan Pengguna',
  `file_path` varchar(255) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `file_size` bigint(20) unsigned NOT NULL DEFAULT 0,
  `updated_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `help_documents_singleton_key_unique` (`singleton_key`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `help_documents`
--

LOCK TABLES `help_documents` WRITE;
/*!40000 ALTER TABLE `help_documents` DISABLE KEYS */;
INSERT INTO `help_documents` VALUES (1,1,'Panduan Penggunaan Portal Jamaah & Travel Agent SAFF','/documents/panduan-umroh-saff-2026.pdf','panduan-umroh-saff-2026.pdf',2458900,1,'2026-10-01 02:34:49','2026-10-01 02:34:49');
/*!40000 ALTER TABLE `help_documents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hotels`
--

DROP TABLE IF EXISTS `hotels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `hotels` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nama_hotel` varchar(255) NOT NULL,
  `alamat` text DEFAULT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `link_maps` text DEFAULT NULL,
  `id_ta` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `hotels_id_ta_foreign` (`id_ta`),
  CONSTRAINT `hotels_id_ta_foreign` FOREIGN KEY (`id_ta`) REFERENCES `travel_agent` (`id_ta`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hotels`
--

LOCK TABLES `hotels` WRITE;
/*!40000 ALTER TABLE `hotels` DISABLE KEYS */;
INSERT INTO `hotels` VALUES (6,'Pullman Zamzam Makkah','Abraj Al Bait Complex, King Abdul Aziz Endowment, Makkah',21.41940000,39.82560000,'https://maps.google.com/?q=21.4194,39.8256',14,'2026-10-01 02:17:37','2026-10-01 02:17:37'),(7,'Swissotel Al Maqam Makkah','King Abdul Aziz Endowment, Abraj Al Bait, Makkah',21.41870000,39.82630000,'https://maps.google.com/?q=21.4187,39.8263',14,'2026-10-01 02:17:37','2026-10-01 02:17:37'),(8,'Dar Al Taqwa Hotel Madinah','Opposite Prophet Mosque King Fahd Gate, Madinah',24.47050000,39.61180000,'https://maps.google.com/?q=24.4705,39.6118',14,'2026-10-01 02:17:37','2026-10-01 02:17:37'),(9,'Pullman Zamzam Madina','Amr Ibn Al Ghas Street, Central Area, Madinah',24.46520000,39.60830000,'https://maps.google.com/?q=24.4652,39.6083',14,'2026-10-01 02:17:37','2026-10-01 02:17:37');
/*!40000 ALTER TABLE `hotels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jamaah`
--

DROP TABLE IF EXISTS `jamaah`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jamaah` (
  `id_jamaah` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nama_jamaah` varchar(255) NOT NULL,
  `nik` varchar(255) NOT NULL,
  `passport` varchar(255) NOT NULL,
  `id_batch` bigint(20) unsigned NOT NULL,
  `nama_pic` varchar(255) DEFAULT NULL,
  `tanggal_lahir` date NOT NULL,
  `gender` varchar(255) NOT NULL,
  `photo` text NOT NULL COMMENT 'Image Path is point to public/pictures/jamaah',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `id_user` bigint(20) unsigned NOT NULL,
  `id_hotel` bigint(20) unsigned DEFAULT NULL,
  `hotel` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_jamaah`),
  UNIQUE KEY `jamaah_nik_unique` (`nik`),
  UNIQUE KEY `jamaah_passport_unique` (`passport`),
  KEY `jamaah_id_batch_foreign` (`id_batch`),
  KEY `jamaah_id_user_foreign` (`id_user`),
  KEY `jamaah_id_hotel_foreign` (`id_hotel`),
  KEY `jamaah_created_at_index` (`created_at`),
  CONSTRAINT `jamaah_id_batch_foreign` FOREIGN KEY (`id_batch`) REFERENCES `batch` (`id_batch`),
  CONSTRAINT `jamaah_id_hotel_foreign` FOREIGN KEY (`id_hotel`) REFERENCES `hotels` (`id`) ON DELETE SET NULL,
  CONSTRAINT `jamaah_id_user_foreign` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jamaah`
--

LOCK TABLES `jamaah` WRITE;
/*!40000 ALTER TABLE `jamaah` DISABLE KEYS */;
INSERT INTO `jamaah` VALUES (13,'QC Patch Jamaah','QC-PATCH-NIK','QC-PATCH-PASS',11,'QC Patch','1990-01-01','L','',1,'2026-09-29 04:45:27','2026-09-29 04:45:27',44,NULL,'QC Hotel'),(14,'Haji Sulaiman Al-Farisi','3273010101900005','SAFF-PASS-999',12,NULL,'1985-05-15','Laki-Laki','67abec',1,'2026-09-29 08:58:50','2026-09-29 08:58:50',46,1,'Pullman ZamZam Makkah Tower 3'),(15,'H. Sulaiman Al-Farisi','32710100000001','C8000000',11,'Keluarga H. Sulaiman Al-Farisi','1975-05-01','Laki-Laki','https://api.dicebear.com/7.x/initials/svg?seed=H.+Sulaiman+Al-Farisi',1,'2026-10-01 02:17:37','2026-10-01 02:17:37',50,6,'Pullman Zamzam Makkah'),(16,'Hj. Siti Aisyah Nurhaliza','32710100000002','C8000001',11,'Keluarga Hj. Siti Aisyah Nurhaliza','1975-05-02','Perempuan','https://api.dicebear.com/7.x/initials/svg?seed=Hj.+Siti+Aisyah+Nurhaliza',1,'2026-10-01 02:17:37','2026-10-01 02:17:37',51,6,'Pullman Zamzam Makkah'),(17,'H. Muhammad Ridwan','32710100000003','C8000002',11,'Keluarga H. Muhammad Ridwan','1975-05-03','Laki-Laki','https://api.dicebear.com/7.x/initials/svg?seed=H.+Muhammad+Ridwan',1,'2026-10-01 02:17:37','2026-10-01 02:17:37',52,6,'Pullman Zamzam Makkah'),(18,'Hj. Khadijah Binti Usman','32710100000004','C8000003',11,'Keluarga Hj. Khadijah Binti Usman','1975-05-04','Perempuan','https://api.dicebear.com/7.x/initials/svg?seed=Hj.+Khadijah+Binti+Usman',1,'2026-10-01 02:17:37','2026-10-01 02:17:37',53,6,'Pullman Zamzam Makkah'),(19,'H. Abdul Rasyid Pratama','32710100000005','C8000004',11,'Keluarga H. Abdul Rasyid Pratama','1975-05-05','Laki-Laki','https://api.dicebear.com/7.x/initials/svg?seed=H.+Abdul+Rasyid+Pratama',1,'2026-10-01 02:17:37','2026-10-01 02:17:37',54,6,'Pullman Zamzam Makkah'),(20,'Hj. Nurul Hidayati','32710100000006','C8000005',11,'Keluarga Hj. Nurul Hidayati','1975-05-06','Perempuan','https://api.dicebear.com/7.x/initials/svg?seed=Hj.+Nurul+Hidayati',1,'2026-10-01 02:17:37','2026-10-01 02:17:37',55,6,'Pullman Zamzam Makkah'),(21,'H. Budi Santoso','32710100000007','C8000006',11,'Keluarga H. Budi Santoso','1975-05-07','Laki-Laki','https://api.dicebear.com/7.x/initials/svg?seed=H.+Budi+Santoso',1,'2026-10-01 02:17:37','2026-10-01 02:17:37',56,6,'Pullman Zamzam Makkah'),(22,'Hj. Endang Sri Wahyuni','32710100000008','C8000007',11,'Keluarga Hj. Endang Sri Wahyuni','1975-05-08','Perempuan','https://api.dicebear.com/7.x/initials/svg?seed=Hj.+Endang+Sri+Wahyuni',1,'2026-10-01 02:17:37','2026-10-01 02:17:37',57,6,'Pullman Zamzam Makkah'),(23,'H. Dedi Irawan Kurnia','32710100000009','C8000008',11,'Keluarga H. Dedi Irawan Kurnia','1975-05-09','Laki-Laki','https://api.dicebear.com/7.x/initials/svg?seed=H.+Dedi+Irawan+Kurnia',1,'2026-10-01 02:17:37','2026-10-01 02:17:37',58,6,'Pullman Zamzam Makkah'),(24,'Hj. Fatimah Zahra','32710100000010','C8000009',11,'Keluarga Hj. Fatimah Zahra','1975-05-10','Perempuan','https://api.dicebear.com/7.x/initials/svg?seed=Hj.+Fatimah+Zahra',1,'2026-10-01 02:17:37','2026-10-01 02:17:37',59,6,'Pullman Zamzam Makkah');
/*!40000 ALTER TABLE `jamaah` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jamaah_device_assignments`
--

DROP TABLE IF EXISTS `jamaah_device_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jamaah_device_assignments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `jamaah_id` bigint(20) unsigned NOT NULL,
  `device_id` bigint(20) unsigned NOT NULL,
  `assigned_at` datetime NOT NULL,
  `unassigned_at` datetime DEFAULT NULL,
  `assigned_by` bigint(20) unsigned DEFAULT NULL,
  `unassigned_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `jamaah_device_assignments_assigned_by_foreign` (`assigned_by`),
  KEY `jamaah_device_assignments_unassigned_by_foreign` (`unassigned_by`),
  KEY `jamaah_device_assignments_device_id_unassigned_at_index` (`device_id`,`unassigned_at`),
  KEY `jamaah_device_assignments_jamaah_id_unassigned_at_index` (`jamaah_id`,`unassigned_at`),
  CONSTRAINT `jamaah_device_assignments_assigned_by_foreign` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id_user`) ON DELETE SET NULL,
  CONSTRAINT `jamaah_device_assignments_device_id_foreign` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `jamaah_device_assignments_jamaah_id_foreign` FOREIGN KEY (`jamaah_id`) REFERENCES `jamaah` (`id_jamaah`) ON DELETE CASCADE,
  CONSTRAINT `jamaah_device_assignments_unassigned_by_foreign` FOREIGN KEY (`unassigned_by`) REFERENCES `users` (`id_user`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jamaah_device_assignments`
--

LOCK TABLES `jamaah_device_assignments` WRITE;
/*!40000 ALTER TABLE `jamaah_device_assignments` DISABLE KEYS */;
INSERT INTO `jamaah_device_assignments` VALUES (1,13,17,'2026-09-27 09:29:00',NULL,42,NULL,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(2,14,18,'2026-09-27 09:29:00',NULL,42,NULL,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(3,15,19,'2026-09-27 09:29:00',NULL,42,NULL,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(4,16,20,'2026-09-27 09:29:00',NULL,42,NULL,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(5,17,21,'2026-09-27 09:29:00',NULL,42,NULL,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(6,18,22,'2026-09-27 09:29:00',NULL,42,NULL,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(7,19,23,'2026-09-27 09:29:00',NULL,42,NULL,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(8,20,24,'2026-09-27 09:29:00',NULL,42,NULL,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(9,21,25,'2026-09-27 09:29:00',NULL,42,NULL,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(10,22,26,'2026-09-27 09:29:00',NULL,42,NULL,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(11,23,27,'2026-09-27 09:29:00',NULL,42,NULL,'2026-10-01 02:29:00','2026-10-01 02:29:00'),(12,24,28,'2026-09-27 09:29:00',NULL,42,NULL,'2026-10-01 02:29:00','2026-10-01 02:29:00');
/*!40000 ALTER TABLE `jamaah_device_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jamaah_import_temp`
--

DROP TABLE IF EXISTS `jamaah_import_temp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jamaah_import_temp` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nama_jamaah` varchar(255) DEFAULT NULL,
  `nik` varchar(255) DEFAULT NULL,
  `passport` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `nomor_telepon` varchar(255) DEFAULT NULL,
  `gender` varchar(255) DEFAULT NULL,
  `tanggal_lahir` varchar(255) DEFAULT NULL,
  `nama_batch` varchar(255) DEFAULT NULL,
  `hotel` varchar(255) DEFAULT NULL,
  `id_hotel` int(11) DEFAULT NULL,
  `link_maps` text DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `photo` varchar(255) DEFAULT NULL,
  `id_batch` int(11) DEFAULT NULL,
  `alamat` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jamaah_import_temp`
--

LOCK TABLES `jamaah_import_temp` WRITE;
/*!40000 ALTER TABLE `jamaah_import_temp` DISABLE KEYS */;
/*!40000 ALTER TABLE `jamaah_import_temp` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `list_batch_room_by_tl`
--

DROP TABLE IF EXISTS `list_batch_room_by_tl`;
/*!50001 DROP VIEW IF EXISTS `list_batch_room_by_tl`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `list_batch_room_by_tl` AS SELECT
 1 AS `pivot_id_tl`,
  1 AS `id_batch_room`,
  1 AS `batch_room_code`,
  1 AS `id_batch`,
  1 AS `nama_batch`,
  1 AS `tanggal_keberangkatan`,
  1 AS `tanggal_kepulangan` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `list_gps_jamaah`
--

DROP TABLE IF EXISTS `list_gps_jamaah`;
/*!50001 DROP VIEW IF EXISTS `list_gps_jamaah`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `list_gps_jamaah` AS SELECT
 1 AS `id`,
  1 AS `id_jamaah`,
  1 AS `id_gps`,
  1 AS `created_at`,
  1 AS `nama_jamaah`,
  1 AS `nama_perangkat`,
  1 AS `id_perangkat`,
  1 AS `id_batch`,
  1 AS `nama_batch`,
  1 AS `id_ta`,
  1 AS `nama_travel_agent`,
  1 AS `have_log_data` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `list_participant_room`
--

DROP TABLE IF EXISTS `list_participant_room`;
/*!50001 DROP VIEW IF EXISTS `list_participant_room`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `list_participant_room` AS SELECT
 1 AS `id_room`,
  1 AS `id_batch`,
  1 AS `id_jamaah`,
  1 AS `id_tl`,
  1 AS `id_user`,
  1 AS `nama_user`,
  1 AS `nomor_telepon`,
  1 AS `photo`,
  1 AS `is_mutawif`,
  1 AS `is_tl` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `livekit_token`
--

DROP TABLE IF EXISTS `livekit_token`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `livekit_token` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_room` bigint(20) unsigned NOT NULL,
  `id_user` bigint(20) unsigned NOT NULL,
  `token` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `expired_at` date NOT NULL,
  PRIMARY KEY (`id`),
  KEY `livekit_token_id_room_foreign` (`id_room`),
  KEY `livekit_token_id_user_foreign` (`id_user`),
  CONSTRAINT `livekit_token_id_room_foreign` FOREIGN KEY (`id_room`) REFERENCES `batch_room` (`id_batch_room`),
  CONSTRAINT `livekit_token_id_user_foreign` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `livekit_token`
--

LOCK TABLES `livekit_token` WRITE;
/*!40000 ALTER TABLE `livekit_token` DISABLE KEYS */;
/*!40000 ALTER TABLE `livekit_token` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `log_activities`
--

DROP TABLE IF EXISTS `log_activities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_activities` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `Action` varchar(255) DEFAULT NULL,
  `Desc` varchar(255) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `id_user` bigint(20) unsigned DEFAULT NULL,
  `id_target_user` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `log_activities_id_user_foreign` (`id_user`),
  KEY `log_activities_id_target_user_foreign` (`id_target_user`),
  CONSTRAINT `log_activities_id_target_user_foreign` FOREIGN KEY (`id_target_user`) REFERENCES `users` (`id_user`),
  CONSTRAINT `log_activities_id_user_foreign` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `log_activities`
--

LOCK TABLES `log_activities` WRITE;
/*!40000 ALTER TABLE `log_activities` DISABLE KEYS */;
INSERT INTO `log_activities` VALUES (2,'LOGIN','Admin login ke dashboard Travel Agent SAFF','AUTH',19,NULL,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(3,'ASSIGN_DEVICE','Mengaitkan Smartwatch Wonlex ke Jamaah Siti Fatimah','DEVICE',19,59,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(4,'BROADCAST_MESSAGE','Mengirimkan pesan broadcast pengingat Miqat Bir Ali','BROADCAST',19,NULL,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(5,'RESOLVE_SOS','Menangani dan menyelesaikan status SOS medis jamaah','SOS',19,59,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(6,'UPDATE_CONFIG','Memperbarui interval tracking lokasi ke 15 detik','SYSTEM',19,NULL,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(7,'START_VOICE_ROOM','Memulai room audio bimbingan thawaf massal','AUDIO',19,NULL,'2026-10-01 02:34:49','2026-10-01 02:34:49');
/*!40000 ALTER TABLE `log_activities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `log_approval`
--

DROP TABLE IF EXISTS `log_approval`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_approval` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_batch` int(11) NOT NULL,
  `code_batch` varchar(255) NOT NULL,
  `id_batch_room` int(11) NOT NULL,
  `code_batch_room` varchar(255) NOT NULL,
  `nomor_keberangkatan` varchar(255) NOT NULL,
  `tanggal_keberangkatan` date NOT NULL,
  `tanggal_kepulangan` date NOT NULL,
  `id_travel_agent` int(11) NOT NULL,
  `nama_travel_agent` varchar(255) NOT NULL,
  `code_travel_agent` varchar(255) NOT NULL,
  `total_leader` int(11) NOT NULL,
  `data_leader` text NOT NULL,
  `total_jamaah` int(11) NOT NULL,
  `data_jamaah` text NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `action` text NOT NULL,
  `reason` text NOT NULL,
  `status` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `log_approval`
--

LOCK TABLES `log_approval` WRITE;
/*!40000 ALTER TABLE `log_approval` DISABLE KEYS */;
/*!40000 ALTER TABLE `log_approval` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `log_gps`
--

DROP TABLE IF EXISTS `log_gps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_gps` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_gps` bigint(20) unsigned NOT NULL,
  `battery_percent` int(11) NOT NULL,
  `latitude` text NOT NULL,
  `longitude` text NOT NULL,
  `device_time` datetime NOT NULL DEFAULT current_timestamp(),
  `positionId_traccar` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `log_gps_id_gps_foreign` (`id_gps`),
  CONSTRAINT `log_gps_id_gps_foreign` FOREIGN KEY (`id_gps`) REFERENCES `device_gps` (`id_gps`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `log_gps`
--

LOCK TABLES `log_gps` WRITE;
/*!40000 ALTER TABLE `log_gps` DISABLE KEYS */;
INSERT INTO `log_gps` VALUES (9,9,85,'21.422487','39.826206','2026-10-01 09:34:49',80000,'2026-10-01 02:34:49'),(10,10,93,'21.424912','39.828645','2026-10-01 09:34:49',80001,'2026-10-01 02:34:49'),(11,11,79,'21.418700','39.825600','2026-10-01 09:34:49',80002,'2026-10-01 02:34:49'),(12,12,97,'21.413333','39.893333','2026-10-01 09:34:49',80003,'2026-10-01 02:34:49'),(13,13,81,'21.354722','39.984167','2026-10-01 09:34:49',80004,'2026-10-01 02:34:49'),(14,14,94,'24.467211','39.610854','2026-10-01 09:34:49',80005,'2026-10-01 02:34:49'),(15,15,80,'24.468800','39.612500','2026-10-01 09:34:49',80006,'2026-10-01 02:34:49'),(16,16,80,'24.475000','39.600000','2026-10-01 09:34:49',80007,'2026-10-01 02:34:49');
/*!40000 ALTER TABLE `log_gps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `log_location`
--

DROP TABLE IF EXISTS `log_location`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_location` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_user` bigint(20) unsigned NOT NULL,
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(11,7) NOT NULL,
  `location` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `log_location_id_user_foreign` (`id_user`),
  CONSTRAINT `log_location_id_user_foreign` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `log_location`
--

LOCK TABLES `log_location` WRITE;
/*!40000 ALTER TABLE `log_location` DISABLE KEYS */;
INSERT INTO `log_location` VALUES (1,44,21.4225000,39.8262000,'Pelataran Tawaf Masjidil Haram, Makkah','2026-10-01 02:29:00'),(2,44,21.4233000,39.8270000,'Pelataran Tawaf Masjidil Haram, Makkah (Titik Riwayat 1)','2026-10-01 00:29:00'),(3,44,21.4241000,39.8278000,'Pelataran Tawaf Masjidil Haram, Makkah (Titik Riwayat 2)','2026-09-30 22:29:00'),(4,44,21.4249000,39.8286000,'Pelataran Tawaf Masjidil Haram, Makkah (Titik Riwayat 3)','2026-09-30 20:29:00'),(5,46,21.4234000,39.8271000,'Mataf Lantai 1 Shafa-Marwah, Makkah','2026-10-01 02:24:00'),(6,46,21.4242000,39.8279000,'Mataf Lantai 1 Shafa-Marwah, Makkah (Titik Riwayat 1)','2026-10-01 00:29:00'),(7,46,21.4250000,39.8287000,'Mataf Lantai 1 Shafa-Marwah, Makkah (Titik Riwayat 2)','2026-09-30 22:29:00'),(8,46,21.4258000,39.8295000,'Mataf Lantai 1 Shafa-Marwah, Makkah (Titik Riwayat 3)','2026-09-30 20:29:00'),(9,50,21.4201000,39.8248000,'Pintu Gerbang King Abdul Aziz Gate 1, Makkah','2026-10-01 02:19:00'),(10,50,21.4209000,39.8256000,'Pintu Gerbang King Abdul Aziz Gate 1, Makkah (Titik Riwayat 1)','2026-10-01 00:29:00'),(11,50,21.4217000,39.8264000,'Pintu Gerbang King Abdul Aziz Gate 1, Makkah (Titik Riwayat 2)','2026-09-30 22:29:00'),(12,50,21.4225000,39.8272000,'Pintu Gerbang King Abdul Aziz Gate 1, Makkah (Titik Riwayat 3)','2026-09-30 20:29:00'),(13,51,21.4194000,39.8256000,'Hotel Pullman Zamzam Tower Makkah','2026-10-01 02:14:00'),(14,51,21.4202000,39.8264000,'Hotel Pullman Zamzam Tower Makkah (Titik Riwayat 1)','2026-10-01 00:29:00'),(15,51,21.4210000,39.8272000,'Hotel Pullman Zamzam Tower Makkah (Titik Riwayat 2)','2026-09-30 22:29:00'),(16,51,21.4218000,39.8280000,'Hotel Pullman Zamzam Tower Makkah (Titik Riwayat 3)','2026-09-30 20:29:00'),(17,52,21.4248000,39.8239000,'Area Perluasan Sholat Syamiyah, Makkah','2026-10-01 02:09:00'),(18,52,21.4256000,39.8247000,'Area Perluasan Sholat Syamiyah, Makkah (Titik Riwayat 1)','2026-10-01 00:29:00'),(19,52,21.4264000,39.8255000,'Area Perluasan Sholat Syamiyah, Makkah (Titik Riwayat 2)','2026-09-30 22:29:00'),(20,52,21.4272000,39.8263000,'Area Perluasan Sholat Syamiyah, Makkah (Titik Riwayat 3)','2026-09-30 20:29:00'),(21,53,21.4133000,39.8933000,'Tenda Rombongan Maktab 42 Mina','2026-10-01 02:04:00'),(22,53,21.4141000,39.8941000,'Tenda Rombongan Maktab 42 Mina (Titik Riwayat 1)','2026-10-01 00:29:00'),(23,53,21.4149000,39.8949000,'Tenda Rombongan Maktab 42 Mina (Titik Riwayat 2)','2026-09-30 22:29:00'),(24,53,21.4157000,39.8957000,'Tenda Rombongan Maktab 42 Mina (Titik Riwayat 3)','2026-09-30 20:29:00'),(25,54,21.3548000,39.9839000,'Kawasan Padang Arafah Dekat Jabal Rahmah','2026-10-01 01:59:00'),(26,54,21.3556000,39.9847000,'Kawasan Padang Arafah Dekat Jabal Rahmah (Titik Riwayat 1)','2026-10-01 00:29:00'),(27,54,21.3564000,39.9855000,'Kawasan Padang Arafah Dekat Jabal Rahmah (Titik Riwayat 2)','2026-09-30 22:29:00'),(28,54,21.3572000,39.9863000,'Kawasan Padang Arafah Dekat Jabal Rahmah (Titik Riwayat 3)','2026-09-30 20:29:00'),(29,55,24.4672000,39.6108000,'Pelataran Depan Masjid Nabawi, Madinah','2026-10-01 01:54:00'),(30,55,24.4680000,39.6116000,'Pelataran Depan Masjid Nabawi, Madinah (Titik Riwayat 1)','2026-10-01 00:29:00'),(31,55,24.4688000,39.6124000,'Pelataran Depan Masjid Nabawi, Madinah (Titik Riwayat 2)','2026-09-30 22:29:00'),(32,55,24.4696000,39.6132000,'Pelataran Depan Masjid Nabawi, Madinah (Titik Riwayat 3)','2026-09-30 20:29:00'),(33,56,24.4681000,39.6125000,'Area Raudhah Syarifah Makam Rasulullah SAW, Madinah','2026-10-01 01:49:00'),(34,56,24.4689000,39.6133000,'Area Raudhah Syarifah Makam Rasulullah SAW, Madinah (Titik Riwayat 1)','2026-10-01 00:29:00'),(35,56,24.4697000,39.6141000,'Area Raudhah Syarifah Makam Rasulullah SAW, Madinah (Titik Riwayat 2)','2026-09-30 22:29:00'),(36,56,24.4705000,39.6149000,'Area Raudhah Syarifah Makam Rasulullah SAW, Madinah (Titik Riwayat 3)','2026-09-30 20:29:00'),(37,57,24.4705000,39.6118000,'Hotel Dar Al Taqwa Madinah, Pintu 25','2026-10-01 01:44:00'),(38,57,24.4713000,39.6126000,'Hotel Dar Al Taqwa Madinah, Pintu 25 (Titik Riwayat 1)','2026-10-01 00:29:00'),(39,57,24.4721000,39.6134000,'Hotel Dar Al Taqwa Madinah, Pintu 25 (Titik Riwayat 2)','2026-09-30 22:29:00'),(40,57,24.4729000,39.6142000,'Hotel Dar Al Taqwa Madinah, Pintu 25 (Titik Riwayat 3)','2026-09-30 20:29:00'),(41,58,21.4225000,39.8262000,'Pelataran Tawaf Masjidil Haram, Makkah','2026-10-01 01:39:00'),(42,58,21.4233000,39.8270000,'Pelataran Tawaf Masjidil Haram, Makkah (Titik Riwayat 1)','2026-10-01 00:29:00'),(43,58,21.4241000,39.8278000,'Pelataran Tawaf Masjidil Haram, Makkah (Titik Riwayat 2)','2026-09-30 22:29:00'),(44,58,21.4249000,39.8286000,'Pelataran Tawaf Masjidil Haram, Makkah (Titik Riwayat 3)','2026-09-30 20:29:00'),(45,59,21.4234000,39.8271000,'Mataf Lantai 1 Shafa-Marwah, Makkah','2026-10-01 01:34:00'),(46,59,21.4242000,39.8279000,'Mataf Lantai 1 Shafa-Marwah, Makkah (Titik Riwayat 1)','2026-10-01 00:29:00'),(47,59,21.4250000,39.8287000,'Mataf Lantai 1 Shafa-Marwah, Makkah (Titik Riwayat 2)','2026-09-30 22:29:00'),(48,59,21.4258000,39.8295000,'Mataf Lantai 1 Shafa-Marwah, Makkah (Titik Riwayat 3)','2026-09-30 20:29:00'),(49,43,21.4194000,39.8256000,'Hotel Pullman Zamzam Tower Makkah - Pos Muthawif','2026-10-01 02:27:00'),(50,48,21.4248000,39.8239000,'Area Perluasan Sholat Syamiyah, Makkah - Pos Muthawif','2026-10-01 02:27:00'),(51,49,21.4133000,39.8933000,'Tenda Rombongan Maktab 42 Mina - Pos Muthawif','2026-10-01 02:27:00');
/*!40000 ALTER TABLE `log_location` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `log_watch`
--

DROP TABLE IF EXISTS `log_watch`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `log_watch` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `battery_percentage` double DEFAULT NULL,
  `blood_oxygen` double(8,2) DEFAULT NULL,
  `temperature` double(8,2) DEFAULT NULL,
  `longitude` varchar(255) NOT NULL,
  `latitude` varchar(255) NOT NULL,
  `heart_rate` double(8,2) DEFAULT NULL,
  `high_preasure` double(8,2) DEFAULT NULL,
  `low_preasure` double(8,2) DEFAULT NULL,
  `device_time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `positionId_traccar` bigint(20) unsigned NOT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `id_watch_jamaah` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `log_watch_id_watch_jamaah_foreign` (`id_watch_jamaah`),
  CONSTRAINT `log_watch_id_watch_jamaah_foreign` FOREIGN KEY (`id_watch_jamaah`) REFERENCES `watch_jamaah` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `log_watch`
--

LOCK TABLES `log_watch` WRITE;
/*!40000 ALTER TABLE `log_watch` DISABLE KEYS */;
INSERT INTO `log_watch` VALUES (21,99,97.90,36.90,'39.826206','21.422487',83.00,120.00,80.00,'2026-10-01 02:34:48',90000,NULL,'2026-10-01 02:34:48',21),(22,71,98.50,36.60,'39.828645','21.424912',89.00,120.00,80.00,'2026-10-01 02:34:48',90001,NULL,'2026-10-01 02:34:48',22),(23,70,96.00,37.00,'39.825600','21.418700',73.00,120.00,80.00,'2026-10-01 02:34:48',90002,NULL,'2026-10-01 02:34:48',23),(24,95,98.60,36.70,'39.893333','21.413333',80.00,120.00,80.00,'2026-10-01 02:34:48',90003,NULL,'2026-10-01 02:34:48',24),(25,94,99.20,36.60,'39.984167','21.354722',83.00,120.00,80.00,'2026-10-01 02:34:48',90004,NULL,'2026-10-01 02:34:48',25),(26,76,98.20,37.10,'39.610854','24.467211',87.00,120.00,80.00,'2026-10-01 02:34:48',90005,NULL,'2026-10-01 02:34:48',26),(27,95,98.90,36.40,'39.612500','24.468800',80.00,120.00,80.00,'2026-10-01 02:34:48',90006,NULL,'2026-10-01 02:34:48',27),(28,95,96.80,37.10,'39.600000','24.475000',85.00,120.00,80.00,'2026-10-01 02:34:48',90007,NULL,'2026-10-01 02:34:48',28),(29,70,96.80,36.50,'39.827000','21.422500',80.00,120.00,80.00,'2026-10-01 02:34:48',90008,NULL,'2026-10-01 02:34:48',29),(30,74,98.80,36.40,'39.824000','21.426000',86.00,120.00,80.00,'2026-10-01 02:34:48',90009,NULL,'2026-10-01 02:34:48',30);
/*!40000 ALTER TABLE `log_watch` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `login_data_jamaah`
--

DROP TABLE IF EXISTS `login_data_jamaah`;
/*!50001 DROP VIEW IF EXISTS `login_data_jamaah`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `login_data_jamaah` AS SELECT
 1 AS `id_user`,
  1 AS `username`,
  1 AS `nomor_telepon`,
  1 AS `id_role`,
  1 AS `id_jamaah`,
  1 AS `nama_jamaah`,
  1 AS `is_active`,
  1 AS `id_batch`,
  1 AS `id_ta`,
  1 AS `id_ta_real`,
  1 AS `nama_batch`,
  1 AS `tanggal_keberangkatan`,
  1 AS `tanggal_kepulangan`,
  1 AS `id_batch_room`,
  1 AS `is_batch_open`,
  1 AS `expired_token`,
  1 AS `interval_time_tracking`,
  1 AS `unique_code_batch`,
  1 AS `max_number_of_room` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `login_data_tour_leader`
--

DROP TABLE IF EXISTS `login_data_tour_leader`;
/*!50001 DROP VIEW IF EXISTS `login_data_tour_leader`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `login_data_tour_leader` AS SELECT
 1 AS `id_user`,
  1 AS `username`,
  1 AS `nomor_telepon`,
  1 AS `id_role`,
  1 AS `id_tl`,
  1 AS `id_ta`,
  1 AS `id_ta_real`,
  1 AS `nama_tour_leader`,
  1 AS `status`,
  1 AS `is_active`,
  1 AS `interval_time_tracking`,
  1 AS `unique_code_batch`,
  1 AS `max_number_of_room` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `m_es_code`
--

DROP TABLE IF EXISTS `m_es_code`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `m_es_code` (
  `id_ems` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code_ems` varchar(255) NOT NULL,
  `deskripsi` text NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_ems`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `m_es_code`
--

LOCK TABLES `m_es_code` WRITE;
/*!40000 ALTER TABLE `m_es_code` DISABLE KEYS */;
INSERT INTO `m_es_code` VALUES (1,'SOS','Emergency SOS',1,'2026-09-29 03:22:09','2026-09-29 03:22:09');
/*!40000 ALTER TABLE `m_es_code` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=181 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0000_00_00_000000_create_websockets_statistics_entries_table',1),(2,'2014_10_12_000000_create_users_table',1),(3,'2018_08_08_100000_create_telescope_entries_table',1),(4,'2019_08_19_000000_create_failed_jobs_table',1),(5,'2019_12_14_000001_create_personal_access_tokens_table',1),(6,'2023_11_29_033305_create_travel_agent_table',1),(7,'2023_11_29_033837_create_travel_agent_cabang_table',1),(8,'2023_11_29_042805_create_batch_table',1),(9,'2023_11_29_043118_create_batch_room_table',1),(10,'2023_11_29_043658_create_batch_room_list_table',1),(11,'2023_11_29_043751_create_tour_leader_table',1),(12,'2023_11_29_044658_create_jamaah_table',1),(13,'2023_11_29_063009_create_m_es_code_table',1),(14,'2023_11_29_063210_create_ems_master_table',1),(15,'2023_11_29_063633_create_ems_log_table',1),(16,'2023_11_29_063919_create_position_table',1),(17,'2023_11_29_064228_create_m_pengirim_pesan_table',1),(18,'2023_11_29_064342_create_m_tujuan_pesan_table',1),(19,'2023_11_29_064443_create_broadcast_pesan_table',1),(20,'2023_11_29_071251_add_foreign_keys_to_batch_room_list_table',1),(21,'2023_11_29_073358_add_foreign_keys_to_batch_room_table',1),(22,'2023_11_29_073732_add_foreign_keys_to_tour_leader_table',1),(23,'2023_11_29_074751_add_foreign_keys_to_travel_agent_cabang_table',1),(24,'2023_11_29_075036_add_foreign_keys_to_batch_table',1),(25,'2023_11_29_075232_add_foreign_key_to_jamaah_table',1),(26,'2023_11_29_075701_add_foreign_keys_to_ems_log_table',1),(27,'2023_11_29_080244_add_foreign_keys_to_ems_master_table',1),(28,'2023_11_29_080439_add_foreign_keys_to_brodcast_pesan_table',1),(29,'2023_11_29_083740_alter_column_alamat_in_jamaah_table',1),(30,'2023_11_29_085912_alter_column_alamat_in_travel_agent_table',1),(31,'2023_11_29_094824_alter_coloumn_alamat_in_travel_agent_cabang_table',1),(32,'2023_11_29_094901_alter_coloumn_alamat_in_tour_leader_table',1),(33,'2023_12_01_041900_create_users_table',1),(34,'2023_12_01_042349_create_roles_table',1),(35,'2023_12_01_042449_create_detail_alamat_table',1),(36,'2023_12_01_092511_alter_tour_leader_table',1),(37,'2023_12_01_093607_alter_travel_agent_table',1),(38,'2023_12_01_093850_alter_travel_agent_cabang_table',1),(39,'2023_12_01_094019_add_coloumn_code_cabang_to_travel_agent_cabang_table',1),(40,'2023_12_01_094253_alter_jamaah_table',1),(41,'2023_12_01_115612_add_foreign_keys_to_detail_alamat_table',1),(42,'2023_12_01_115746_add_foreign_keys_to_position_table',1),(43,'2023_12_01_115923_add_foreign_keys_to_users_table',1),(44,'2023_12_07_084828_alter_coloumn_deskripsi_in_roles_table',1),(45,'2023_12_07_141949_alter_column_id_tl_in_batch_room_table',1),(46,'2023_12_07_142427_create_batch_room_leader_table',1),(47,'2023_12_07_142607_add_foreign_keys_to_batch_room_leader',1),(48,'2023_12_08_163013_alter_column_code_tl_in_tour_leader_table',1),(49,'2023_12_08_163501_drop_column_contact_person_in_tour_leader_table',1),(50,'2023_12_11_164522_alter_null_able_column_in_detail_alamat_table',1),(51,'2023_12_13_083127_create_livekit_token_table',1),(52,'2023_12_13_083510_add_foreign_key_to_livekit_token_table',1),(53,'2023_12_14_085707_add_column_expired_at_to_livekit_token_table',1),(54,'2023_12_14_150941_add_column_is_found_in_ems_master_table',1),(55,'2023_12_14_213820_alter_column_in_detail_alamat_table',1),(56,'2023_12_15_105257_alter_foreign_key_broadcast_pesan_table',1),(57,'2023_12_15_105539_drop_m_pengirim_pesan_table',1),(58,'2023_12_15_105556_drop_m_tujuan_pesan_table',1),(59,'2023_12_15_111201_add_column_unhashed_passwor_to_users_table',1),(60,'2023_12_15_134401_drop_column_file_in_broadcast_pesan_table',1),(61,'2023_12_15_134402_create_file_pesan_table',1),(62,'2023_12_15_135434_add_column_judul_pesan_to_broadcast_pesan_table',1),(63,'2023_12_15_135749_add_column_timestamp_close_to_ems_master_table',1),(64,'2023_12_15_141859_add_column_id_jamaah_to_ems_master_table',1),(65,'2023_12_15_142011_add_foreign_key_to_ems_master_table',1),(66,'2023_12_15_142517_add_foreign_key_to_file_pesan_table',1),(67,'2023_12_17_192301_drop_travel_agent_cabang_table',1),(68,'2023_12_17_193233_add_pusat_ta_id_column_to_travel_agent_table',1),(69,'2023_12_17_234329_add_column_is_mutawif_to_batch_room_list_table',1),(70,'2023_12_17_234423_create_device_token_table',1),(71,'2023_12_18_000600_add_foreign_key_to_device_token_table',1),(72,'2023_12_18_000826_create_jamaah_import_temp_table',1),(73,'2023_12_18_004108_add_column_is_read_to_broadcast_pesan_table',1),(74,'2023_12_18_004238_create_log_activites_table',1),(75,'2023_12_18_011751_create_config_app_table',1),(76,'2023_12_18_012250_add_foreign_key_to_config_app_table',1),(77,'2023_12_18_012318_add_foreign_key_to_log_activites_table',1),(78,'2023_12_18_112844_create_province_table',1),(79,'2023_12_18_113109_add_foreign_keys_to_province_table',1),(80,'2023_12_18_114947_create_detail_alamat_table',1),(81,'2023_12_18_121555_add_foreign_keys_to_detail_alamat_table',1),(82,'2023_12_19_111102_alter_column_path_file_and_add_column_nama_file_to_file_pesan_table',1),(83,'2023_12_19_114153_alter_id_ta_to_id_user_in_detail_alamat_table',1),(84,'2023_12_19_115021_add_column_hotel_to_jamaah_table',1),(85,'2023_12_19_130724_alter_column_id_ta_cabang_to_id_ta_in_batch_table',1),(86,'2023_12_19_130939_alter_column_id_ta_cabang_to_id_ta_in_tour_leader_table',1),(87,'2023_12_19_132539_add_column_hotel_to_jamaah_import_temp_table',1),(88,'2023_12_21_100230_create_jobs_table',1),(89,'2023_12_21_164130_alter_column__passwor_to_password_text_in_users_table',1),(90,'2023_12_22_102711_alter_nullable_column_to_ems_master_table',1),(91,'2023_12_23_201354_change_table_name_position_to_position_jamaah',1),(92,'2023_12_23_201528_drop_column_updated_at_in_position_jamaah',1),(93,'2023_12_23_201635_create_position_tour_leader_table',1),(94,'2023_12_23_201737_add_foreign_key_to_position_tour_leader_table',1),(95,'2023_12_23_201943_alter_id_column_to_id_position_jamaah_in_position_jamaah_table',1),(96,'2023_12_27_063618_create_temp_batch_count_table',1),(97,'2023_12_27_075500_add_column_password_to_jamaah_import_temp_table',1),(98,'2023_12_27_145839_add_column_batch_room_code_to_batch_room_table',1),(99,'2024_01_01_111248_create_default_config_app_table',1),(100,'2024_01_03_204742_add_column_is_muthowif_to_batch_room_leader_table',1),(101,'2024_01_10_233020_add_is_rejected_column_to_travel_agent_table',1),(102,'2024_01_12_124408_add_passport_field_and_unique_key_to_jamaah_table',1),(103,'2024_01_12_144553_add_passport_field_to_jamaah_import_temp_table',1),(104,'2024_01_23_101536_add_column_approved_at_to_travel_agent_table',1),(105,'2024_01_26_103053_add_field_effective_until_to_tour_leader',1),(106,'2024_01_26_142043_add_field_nama_pic_to_batch_table',1),(107,'2024_01_26_152812_add_column_nama_pic_to_tour_leader_table',1),(108,'2024_01_26_153825_add_column_nama_pic_to_jamaah_table',1),(109,'2024_01_27_141253_create_user_access_table',1),(110,'2024_01_28_143528_add_column_keterangan_to_users_table',1),(111,'2024_01_29_101427_add_foreign_keys_to_user_access_table',1),(112,'2024_02_01_144550_add_default_date_now_to_created_at',1),(113,'2024_02_01_175052_add_column_nama_pic_to_batch_room_table',1),(114,'2024_02_27_221715_drop_unique_key_email_in_users_table',1),(115,'2024_02_28_174801_add_id_ta_column_in_users_table',1),(116,'2024_02_28_190811_delete_unique_username_field_in_users_table',1),(117,'2024_02_29_094002_filled_id_ta_column_in_users_table',1),(118,'2024_03_14_102606_add_is_read_admin_column_to_broadcast_pesan_table',1),(119,'2024_03_18_111147_create_device_gps_table',1),(120,'2024_03_18_112835_create_gps_jamaah_table',1),(121,'2024_03_18_114833_create_log_gps_table',1),(122,'2024_03_21_131749_change_column_name_server_time_to_device_time_in_log_gps_table',1),(123,'2024_03_25_074226_alter_nullable_column_id_koper_in_table_device_gps',1),(124,'2024_05_07_075702_add_column_approval_to_batchroom_table',1),(125,'2024_05_07_084940_create_log_approval_table',1),(126,'2024_05_13_153347_add_column_is_active_to_batch_room_leader_table',1),(127,'2024_05_13_154606_add_column_is_active_to_batch_room_list_table',1),(128,'2024_09_18_232051_create_agenda_table',1),(129,'2024_09_19_192752_add_column_file_jadwal_kegiatan_in_table_batch',1),(130,'2024_09_23_131815_drop_table_agenda',1),(131,'2024_09_27_104654_create_doas_table',1),(132,'2024_10_16_110415_create_device_watch_table',1),(133,'2024_10_16_110431_create_watch_jamaah_table',1),(134,'2024_10_16_110444_create_log_watch_table',1),(135,'2024_10_16_162650_add_foreign_key_to_device_watch_table',1),(136,'2024_10_16_162909_add_foreign_key_to_watch_jamaah_table',1),(137,'2024_10_16_163048_add_foreign_key_to_log_watch_table',1),(138,'2024_10_17_085319_alter_column_id_watch_into_id_watch_jamaah_to_table_log_watch',1),(139,'2024_10_17_091846_add_foreign_key_id_watch_jamaah_to_log_watch_table',1),(140,'2024_10_24_083228_add_colum_categories_to_table_doa',1),(141,'2024_10_24_103131_set_nullable_column_battery_percentage_log_watch_table',1),(142,'2024_11_01_000001_create_doa_kategori_table',1),(143,'2024_11_01_000002_create_doa_has_kategori_table',1),(144,'2024_11_01_000003_drop_kategori_column_from_doa_table',1),(145,'2024_12_19_093043_add_field_os_into_device_token_table',1),(146,'2025_01_06_111826_create_rating_categories_table',1),(147,'2025_01_06_112313_create_rating_table',1),(148,'2025_05_07_115907_create_hotels_table',1),(149,'2025_05_07_140530_add_id_hotel_to_jamaah_table',1),(150,'2026_05_08_133122_create_log_location_table',1),(151,'2026_05_08_133123_change_lat_long_type_in_log_location_table',1),(152,'2026_06_22_220000_expand_prayer_schema',1),(153,'2026_06_23_090000_add_visual_fields_to_doa_kategori_table',1),(154,'2026_06_26_151619_create_voice_rooms_and_related_tables',1),(155,'2026_06_29_000000_create_prayer_sessions_table',1),(156,'2026_06_30_000000_create_prayer_session_participants_table',1),(157,'2026_06_30_163123_add_indexes_to_jamaah_and_ems_master_tables',1),(158,'2026_07_06_080000_update_voice_room_views_to_be_batch_scoped',1),(159,'2026_07_08_090316_add_columns_to_jamaah_import_temp_table',1),(160,'2026_07_09_100000_create_family_tracking_codes_table',1),(161,'2026_07_10_100000_create_news_table',1),(162,'2026_07_10_111707_create_mitras_table',1),(163,'2026_07_10_111708_create_testimonials_table',1),(164,'2026_07_10_130000_create_product_videos_table',1),(165,'2026_07_13_105552_add_firestore_room_id_to_batch_room_table',1),(166,'2026_07_15_162912_add_details_to_prayer_sessions_table',1),(167,'2026_07_22_100000_fill_null_firestore_room_ids',1),(168,'2026_08_03_100000_create_help_documents_table',1),(169,'2026_08_06_120000_create_sos_radius_configs_table',1),(170,'2026_08_07_000001_create_devices_table',1),(171,'2026_08_07_000002_create_jamaah_device_assignments_table',1),(172,'2026_08_07_000003_create_device_states_table',1),(173,'2026_08_07_000004_create_device_positions_table',1),(174,'2026_08_10_000001_extend_traccar_telemetry_tables',1),(175,'2026_08_10_000002_ensure_sos_emergency_code',1),(176,'2026_08_12_000001_extend_devices_with_lifecycle',2),(177,'2026_08_12_000002_create_device_profile_tables',2),(178,'2026_08_12_000003_create_device_analysis_tables',3),(179,'2026_08_12_000004_create_device_diagnostic_tables',3),(180,'2026_08_18_170000_create_user_sessions_table',4);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mitras`
--

DROP TABLE IF EXISTS `mitras`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mitras` (
  `id_mitra` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `mitra_name` varchar(255) NOT NULL,
  `mitra_url` varchar(255) DEFAULT NULL,
  `mitra_img` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_mitra`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mitras`
--

LOCK TABLES `mitras` WRITE;
/*!40000 ALTER TABLE `mitras` DISABLE KEYS */;
INSERT INTO `mitras` VALUES (1,'Kementerian Agama RI','https://kemenag.go.id','https://kemenag.go.id/favicon.ico','2026-10-01 02:17:37','2026-10-01 02:17:37'),(2,'BPKH RI','https://bpkh.go.id','https://bpkh.go.id/favicon.ico','2026-10-01 02:17:37','2026-10-01 02:17:37'),(3,'Garuda Indonesia','https://garuda-indonesia.com','https://garuda-indonesia.com/favicon.ico','2026-10-01 02:17:37','2026-10-01 02:17:37'),(4,'Saudia Airlines','https://saudia.com','https://saudia.com/favicon.ico','2026-10-01 02:17:37','2026-10-01 02:17:37'),(5,'Bank Syariah Indonesia (BSI)','https://bankbsi.co.id','https://bankbsi.co.id/favicon.ico','2026-10-01 02:17:37','2026-10-01 02:17:37'),(6,'Asosiasi AMPHURI','https://amphuri.org','https://amphuri.org/favicon.ico','2026-10-01 02:17:37','2026-10-01 02:17:37');
/*!40000 ALTER TABLE `mitras` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `mutawif_by_batch_room`
--

DROP TABLE IF EXISTS `mutawif_by_batch_room`;
/*!50001 DROP VIEW IF EXISTS `mutawif_by_batch_room`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `mutawif_by_batch_room` AS SELECT
 1 AS `id_batch_room`,
  1 AS `id_jamaah` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `mutowif_from_users`
--

DROP TABLE IF EXISTS `mutowif_from_users`;
/*!50001 DROP VIEW IF EXISTS `mutowif_from_users`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `mutowif_from_users` AS SELECT
 1 AS `id_batch`,
  1 AS `id_tl`,
  1 AS `id_user`,
  1 AS `nama_mutawif` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `news`
--

DROP TABLE IF EXISTS `news`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `news` (
  `id_berita` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `judul` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `news_img` varchar(255) DEFAULT NULL,
  `view_count` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_berita`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `news`
--

LOCK TABLES `news` WRITE;
/*!40000 ALTER TABLE `news` DISABLE KEYS */;
INSERT INTO `news` VALUES (1,'Kemenag Tetapkan Kuota Haji dan Skema Layanan Digital Jamaah Indonesia 1448H','Kementerian Agama Republik Indonesia resmi mengumumkan pembaruan kuota haji dan integrasi sistem pemantauan digital berbasis IoT dan smartwatch untuk memastikan keselamatan dan kenyamanan seluruh jamaah haji reguler maupun khusus di Tanah Suci. Sistem ini memungkinkan travel agent dan keluarga memantau titik koordinat jamaah secara real-time selama prosesi Armuzna.','https://images.unsplash.com/photo-1591604129939-f1efa4d9f7fa?w=800&auto=format&fit=crop',1422,'2026-09-29 02:17:37','2026-10-01 03:46:43'),(2,'Panduan Manasik Umrah Lengkap: Doa, Rukun, dan Tata Cara Miqat yang Benar','Melaksanakan ibadah umrah memerlukan pemahaman mendalam tentang tata cara niat dari Miqat, tawaf mengelilingi Ka\'bah, sa\'i antara Shafa dan Marwah, hingga tahallul. Pastikan seluruh jamaah membekali diri dengan hafalan doa-doa maqbul yang kini telah terintegrasi dalam fitur Panduan Doa Digital SAFF.','https://images.unsplash.com/photo-1564769625905-50e93615e769?w=800&auto=format&fit=crop',2850,'2026-09-26 02:17:37','2026-09-26 02:17:37'),(3,'Inovasi Smartwatch IoT SAFF: Deteksi Dini Vital Sign dan Tombol SOS Jamaah Lansia','Keberadaan teknologi jam tangan pintar pintar buatan anak bangsa ini menjadi penolong utama bagi ribuan jamaah umrah lanjut usia. Dilengkapi sensor detak jantung, saturasi oksigen, pedometer langkah thawaf, dan tombol darurat instan yang langsung terhubung ke dashboard muthawif.','https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop',975,'2026-09-23 02:17:37','2026-09-23 02:17:37'),(4,'Tips Memilih Travel Umrah Berizin Resmi Kemenag: Hindari Penipuan dan Visa Ilegal','Masyarakat diimbau selalu menerapkan prinsip 5 Pasti Umrah: Pasti Travelnya Berizin, Pasti Tiket Pesawatnya, Pasti Jadwal Keberangkatannya, Pasti Hotelnya, dan Pasti Visanya. Melalui sistem verifikasi travel agent SAFF, jamaah mendapatkan garansi transparansi penuh jadwal dan akomodasi.','https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop',1120,'2026-09-19 02:17:37','2026-09-19 02:17:37'),(5,'Pemerintah Arab Saudi Rilis Aturan Baru Tasreh Masuk Raudhah Syarifah Via Nusuk','Otoritas Umum Urusan Masjid Nabawi memperketat akses masuk ke Rawdah As-Syarifah dengan sistem appointment satu kali dalam setahun untuk setiap jamaah. Muthawif dan Tour Leader diwajibkan mengkoordinasikan rombongan jamaah sesuai jadwal batch resmi agar ibadah berjalan tertib.','https://images.unsplash.com/photo-1580418827493-f2b22c0a76cb?w=800&auto=format&fit=crop',3410,'2026-09-16 02:17:37','2026-09-16 02:17:37');
/*!40000 ALTER TABLE `news` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `position_jamaah`
--

DROP TABLE IF EXISTS `position_jamaah`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `position_jamaah` (
  `id_position_jamaah` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_jamaah` bigint(20) unsigned NOT NULL,
  `tanggal` date NOT NULL,
  `waktu` time NOT NULL,
  `latitude` text NOT NULL,
  `longitude` text NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_position_jamaah`),
  KEY `position_id_jamaah_foreign` (`id_jamaah`),
  CONSTRAINT `position_id_jamaah_foreign` FOREIGN KEY (`id_jamaah`) REFERENCES `jamaah` (`id_jamaah`)
) ENGINE=InnoDB AUTO_INCREMENT=452 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `position_jamaah`
--

LOCK TABLES `position_jamaah` WRITE;
/*!40000 ALTER TABLE `position_jamaah` DISABLE KEYS */;
INSERT INTO `position_jamaah` VALUES (302,13,'2026-09-29','04:30:00','21.422487','39.825606','2026-10-01 02:34:48','2026-10-01 02:34:48'),(303,13,'2026-09-29','08:15:00','21.423687','39.825306','2026-10-01 02:34:48','2026-10-01 02:34:48'),(304,13,'2026-09-29','12:00:00','21.421287','39.824706','2026-10-01 02:34:48','2026-10-01 02:34:48'),(305,13,'2026-09-29','16:45:00','21.421387','39.827306','2026-10-01 02:34:48','2026-10-01 02:34:48'),(306,13,'2026-09-29','20:30:00','21.423587','39.826706','2026-10-01 02:34:48','2026-10-01 02:34:48'),(307,13,'2026-09-30','04:30:00','21.421487','39.825706','2026-10-01 02:34:48','2026-10-01 02:34:48'),(308,13,'2026-09-30','08:15:00','21.421987','39.825606','2026-10-01 02:34:48','2026-10-01 02:34:48'),(309,13,'2026-09-30','12:00:00','21.423887','39.826006','2026-10-01 02:34:48','2026-10-01 02:34:48'),(310,13,'2026-09-30','16:45:00','21.422687','39.825906','2026-10-01 02:34:48','2026-10-01 02:34:48'),(311,13,'2026-09-30','20:30:00','21.423087','39.826906','2026-10-01 02:34:48','2026-10-01 02:34:48'),(312,13,'2026-10-01','04:30:00','21.421187','39.824706','2026-10-01 02:34:48','2026-10-01 02:34:48'),(313,13,'2026-10-01','08:15:00','21.420987','39.826606','2026-10-01 02:34:48','2026-10-01 02:34:48'),(314,13,'2026-10-01','12:00:00','21.421887','39.826106','2026-10-01 02:34:48','2026-10-01 02:34:48'),(315,13,'2026-10-01','16:45:00','21.421887','39.827206','2026-10-01 02:34:48','2026-10-01 02:34:48'),(316,13,'2026-10-01','20:30:00','21.421787','39.825406','2026-10-01 02:34:48','2026-10-01 02:34:48'),(317,14,'2026-09-29','04:30:00','21.423712','39.828645','2026-10-01 02:34:48','2026-10-01 02:34:48'),(318,14,'2026-09-29','08:15:00','21.423512','39.828645','2026-10-01 02:34:48','2026-10-01 02:34:48'),(319,14,'2026-09-29','12:00:00','21.426112','39.829645','2026-10-01 02:34:48','2026-10-01 02:34:48'),(320,14,'2026-09-29','16:45:00','21.426212','39.828345','2026-10-01 02:34:48','2026-10-01 02:34:48'),(321,14,'2026-09-29','20:30:00','21.425112','39.829945','2026-10-01 02:34:48','2026-10-01 02:34:48'),(322,14,'2026-09-30','04:30:00','21.423412','39.827845','2026-10-01 02:34:48','2026-10-01 02:34:48'),(323,14,'2026-09-30','08:15:00','21.426412','39.827745','2026-10-01 02:34:48','2026-10-01 02:34:48'),(324,14,'2026-09-30','12:00:00','21.424212','39.827745','2026-10-01 02:34:48','2026-10-01 02:34:48'),(325,14,'2026-09-30','16:45:00','21.425812','39.829545','2026-10-01 02:34:48','2026-10-01 02:34:48'),(326,14,'2026-09-30','20:30:00','21.424912','39.827145','2026-10-01 02:34:48','2026-10-01 02:34:48'),(327,14,'2026-10-01','04:30:00','21.424412','39.828445','2026-10-01 02:34:48','2026-10-01 02:34:48'),(328,14,'2026-10-01','08:15:00','21.423512','39.827645','2026-10-01 02:34:48','2026-10-01 02:34:48'),(329,14,'2026-10-01','12:00:00','21.425112','39.829745','2026-10-01 02:34:48','2026-10-01 02:34:48'),(330,14,'2026-10-01','16:45:00','21.424312','39.827945','2026-10-01 02:34:48','2026-10-01 02:34:48'),(331,14,'2026-10-01','20:30:00','21.424812','39.829045','2026-10-01 02:34:48','2026-10-01 02:34:48'),(332,15,'2026-09-29','04:30:00','21.4198','39.8243','2026-10-01 02:34:48','2026-10-01 02:34:48'),(333,15,'2026-09-29','08:15:00','21.4179','39.8256','2026-10-01 02:34:48','2026-10-01 02:34:48'),(334,15,'2026-09-29','12:00:00','21.4179','39.8265','2026-10-01 02:34:48','2026-10-01 02:34:48'),(335,15,'2026-09-29','16:45:00','21.4181','39.8243','2026-10-01 02:34:48','2026-10-01 02:34:48'),(336,15,'2026-09-29','20:30:00','21.4175','39.8257','2026-10-01 02:34:48','2026-10-01 02:34:48'),(337,15,'2026-09-30','04:30:00','21.4186','39.8266','2026-10-01 02:34:48','2026-10-01 02:34:48'),(338,15,'2026-09-30','08:15:00','21.4187','39.8241','2026-10-01 02:34:48','2026-10-01 02:34:48'),(339,15,'2026-09-30','12:00:00','21.418','39.8257','2026-10-01 02:34:48','2026-10-01 02:34:48'),(340,15,'2026-09-30','16:45:00','21.4193','39.8253','2026-10-01 02:34:48','2026-10-01 02:34:48'),(341,15,'2026-09-30','20:30:00','21.4192','39.827','2026-10-01 02:34:48','2026-10-01 02:34:48'),(342,15,'2026-10-01','04:30:00','21.4186','39.8255','2026-10-01 02:34:48','2026-10-01 02:34:48'),(343,15,'2026-10-01','08:15:00','21.4179','39.8242','2026-10-01 02:34:48','2026-10-01 02:34:48'),(344,15,'2026-10-01','12:00:00','21.4182','39.8254','2026-10-01 02:34:48','2026-10-01 02:34:48'),(345,15,'2026-10-01','16:45:00','21.4197','39.8246','2026-10-01 02:34:48','2026-10-01 02:34:48'),(346,15,'2026-10-01','20:30:00','21.4178','39.8244','2026-10-01 02:34:48','2026-10-01 02:34:48'),(347,16,'2026-09-29','04:30:00','21.413133','39.892433','2026-10-01 02:34:48','2026-10-01 02:34:48'),(348,16,'2026-09-29','08:15:00','21.412033','39.893933','2026-10-01 02:34:48','2026-10-01 02:34:48'),(349,16,'2026-09-29','12:00:00','21.412333','39.893733','2026-10-01 02:34:48','2026-10-01 02:34:48'),(350,16,'2026-09-29','16:45:00','21.412233','39.894633','2026-10-01 02:34:48','2026-10-01 02:34:48'),(351,16,'2026-09-29','20:30:00','21.413133','39.891933','2026-10-01 02:34:48','2026-10-01 02:34:48'),(352,16,'2026-09-30','04:30:00','21.412933','39.894033','2026-10-01 02:34:48','2026-10-01 02:34:48'),(353,16,'2026-09-30','08:15:00','21.413533','39.892933','2026-10-01 02:34:48','2026-10-01 02:34:48'),(354,16,'2026-09-30','12:00:00','21.413433','39.894133','2026-10-01 02:34:48','2026-10-01 02:34:48'),(355,16,'2026-09-30','16:45:00','21.414333','39.894633','2026-10-01 02:34:48','2026-10-01 02:34:48'),(356,16,'2026-09-30','20:30:00','21.412733','39.892133','2026-10-01 02:34:48','2026-10-01 02:34:48'),(357,16,'2026-10-01','04:30:00','21.414133','39.894233','2026-10-01 02:34:48','2026-10-01 02:34:48'),(358,16,'2026-10-01','08:15:00','21.413333','39.894633','2026-10-01 02:34:48','2026-10-01 02:34:48'),(359,16,'2026-10-01','12:00:00','21.413733','39.892133','2026-10-01 02:34:48','2026-10-01 02:34:48'),(360,16,'2026-10-01','16:45:00','21.411833','39.893633','2026-10-01 02:34:48','2026-10-01 02:34:48'),(361,16,'2026-10-01','20:30:00','21.412233','39.894033','2026-10-01 02:34:48','2026-10-01 02:34:48'),(362,17,'2026-09-29','04:30:00','21.354822','39.983067','2026-10-01 02:34:48','2026-10-01 02:34:48'),(363,17,'2026-09-29','08:15:00','21.354822','39.985367','2026-10-01 02:34:48','2026-10-01 02:34:48'),(364,17,'2026-09-29','12:00:00','21.355922','39.982767','2026-10-01 02:34:48','2026-10-01 02:34:48'),(365,17,'2026-09-29','16:45:00','21.353422','39.985167','2026-10-01 02:34:48','2026-10-01 02:34:48'),(366,17,'2026-09-29','20:30:00','21.355122','39.984967','2026-10-01 02:34:48','2026-10-01 02:34:48'),(367,17,'2026-09-30','04:30:00','21.354722','39.984667','2026-10-01 02:34:48','2026-10-01 02:34:48'),(368,17,'2026-09-30','08:15:00','21.354822','39.983767','2026-10-01 02:34:48','2026-10-01 02:34:48'),(369,17,'2026-09-30','12:00:00','21.353922','39.984467','2026-10-01 02:34:48','2026-10-01 02:34:48'),(370,17,'2026-09-30','16:45:00','21.354222','39.983867','2026-10-01 02:34:48','2026-10-01 02:34:48'),(371,17,'2026-09-30','20:30:00','21.356122','39.983367','2026-10-01 02:34:48','2026-10-01 02:34:48'),(372,17,'2026-10-01','04:30:00','21.354022','39.985167','2026-10-01 02:34:48','2026-10-01 02:34:48'),(373,17,'2026-10-01','08:15:00','21.355822','39.983167','2026-10-01 02:34:48','2026-10-01 02:34:48'),(374,17,'2026-10-01','12:00:00','21.354022','39.982867','2026-10-01 02:34:48','2026-10-01 02:34:48'),(375,17,'2026-10-01','16:45:00','21.353922','39.984167','2026-10-01 02:34:48','2026-10-01 02:34:48'),(376,17,'2026-10-01','20:30:00','21.355622','39.984867','2026-10-01 02:34:48','2026-10-01 02:34:48'),(377,18,'2026-09-29','04:30:00','24.465711','39.612054','2026-10-01 02:34:48','2026-10-01 02:34:48'),(378,18,'2026-09-29','08:15:00','24.468111','39.610454','2026-10-01 02:34:48','2026-10-01 02:34:48'),(379,18,'2026-09-29','12:00:00','24.468711','39.612354','2026-10-01 02:34:48','2026-10-01 02:34:48'),(380,18,'2026-09-29','16:45:00','24.468411','39.611954','2026-10-01 02:34:48','2026-10-01 02:34:48'),(381,18,'2026-09-29','20:30:00','24.466411','39.611354','2026-10-01 02:34:48','2026-10-01 02:34:48'),(382,18,'2026-09-30','04:30:00','24.467011','39.610354','2026-10-01 02:34:48','2026-10-01 02:34:48'),(383,18,'2026-09-30','08:15:00','24.466411','39.609354','2026-10-01 02:34:48','2026-10-01 02:34:48'),(384,18,'2026-09-30','12:00:00','24.468511','39.611854','2026-10-01 02:34:48','2026-10-01 02:34:48'),(385,18,'2026-09-30','16:45:00','24.468511','39.612354','2026-10-01 02:34:48','2026-10-01 02:34:48'),(386,18,'2026-09-30','20:30:00','24.468111','39.609354','2026-10-01 02:34:48','2026-10-01 02:34:48'),(387,18,'2026-10-01','04:30:00','24.467111','39.611154','2026-10-01 02:34:48','2026-10-01 02:34:48'),(388,18,'2026-10-01','08:15:00','24.468611','39.610354','2026-10-01 02:34:48','2026-10-01 02:34:48'),(389,18,'2026-10-01','12:00:00','24.467811','39.610354','2026-10-01 02:34:48','2026-10-01 02:34:48'),(390,18,'2026-10-01','16:45:00','24.466911','39.612154','2026-10-01 02:34:48','2026-10-01 02:34:48'),(391,18,'2026-10-01','20:30:00','24.467011','39.611054','2026-10-01 02:34:48','2026-10-01 02:34:48'),(392,19,'2026-09-29','04:30:00','24.4678','39.611','2026-10-01 02:34:49','2026-10-01 02:34:49'),(393,19,'2026-09-29','08:15:00','24.4701','39.6128','2026-10-01 02:34:49','2026-10-01 02:34:49'),(394,19,'2026-09-29','12:00:00','24.4702','39.6137','2026-10-01 02:34:49','2026-10-01 02:34:49'),(395,19,'2026-09-29','16:45:00','24.4686','39.612','2026-10-01 02:34:49','2026-10-01 02:34:49'),(396,19,'2026-09-29','20:30:00','24.4684','39.6128','2026-10-01 02:34:49','2026-10-01 02:34:49'),(397,19,'2026-09-30','04:30:00','24.4676','39.6136','2026-10-01 02:34:49','2026-10-01 02:34:49'),(398,19,'2026-09-30','08:15:00','24.47','39.6136','2026-10-01 02:34:49','2026-10-01 02:34:49'),(399,19,'2026-09-30','12:00:00','24.468','39.6125','2026-10-01 02:34:49','2026-10-01 02:34:49'),(400,19,'2026-09-30','16:45:00','24.4677','39.6126','2026-10-01 02:34:49','2026-10-01 02:34:49'),(401,19,'2026-09-30','20:30:00','24.4681','39.6129','2026-10-01 02:34:49','2026-10-01 02:34:49'),(402,19,'2026-10-01','04:30:00','24.4696','39.6136','2026-10-01 02:34:49','2026-10-01 02:34:49'),(403,19,'2026-10-01','08:15:00','24.4677','39.6128','2026-10-01 02:34:49','2026-10-01 02:34:49'),(404,19,'2026-10-01','12:00:00','24.4676','39.6126','2026-10-01 02:34:49','2026-10-01 02:34:49'),(405,19,'2026-10-01','16:45:00','24.4694','39.6129','2026-10-01 02:34:49','2026-10-01 02:34:49'),(406,19,'2026-10-01','20:30:00','24.4698','39.6136','2026-10-01 02:34:49','2026-10-01 02:34:49'),(407,20,'2026-09-29','04:30:00','24.4736','39.6005','2026-10-01 02:34:49','2026-10-01 02:34:49'),(408,20,'2026-09-29','08:15:00','24.4739','39.5986','2026-10-01 02:34:49','2026-10-01 02:34:49'),(409,20,'2026-09-29','12:00:00','24.4755','39.5993','2026-10-01 02:34:49','2026-10-01 02:34:49'),(410,20,'2026-09-29','16:45:00','24.4747','39.6014','2026-10-01 02:34:49','2026-10-01 02:34:49'),(411,20,'2026-09-29','20:30:00','24.4759','39.6009','2026-10-01 02:34:49','2026-10-01 02:34:49'),(412,20,'2026-09-30','04:30:00','24.4743','39.601','2026-10-01 02:34:49','2026-10-01 02:34:49'),(413,20,'2026-09-30','08:15:00','24.4745','39.599','2026-10-01 02:34:49','2026-10-01 02:34:49'),(414,20,'2026-09-30','12:00:00','24.4757','39.5995','2026-10-01 02:34:49','2026-10-01 02:34:49'),(415,20,'2026-09-30','16:45:00','24.4757','39.5993','2026-10-01 02:34:49','2026-10-01 02:34:49'),(416,20,'2026-09-30','20:30:00','24.4748','39.6005','2026-10-01 02:34:49','2026-10-01 02:34:49'),(417,20,'2026-10-01','04:30:00','24.4758','39.599','2026-10-01 02:34:49','2026-10-01 02:34:49'),(418,20,'2026-10-01','08:15:00','24.4756','39.6012','2026-10-01 02:34:49','2026-10-01 02:34:49'),(419,20,'2026-10-01','12:00:00','24.4743','39.6012','2026-10-01 02:34:49','2026-10-01 02:34:49'),(420,20,'2026-10-01','16:45:00','24.4748','39.6002','2026-10-01 02:34:49','2026-10-01 02:34:49'),(421,20,'2026-10-01','20:30:00','24.4745','39.5997','2026-10-01 02:34:49','2026-10-01 02:34:49'),(422,21,'2026-09-29','04:30:00','21.424','39.8282','2026-10-01 02:34:49','2026-10-01 02:34:49'),(423,21,'2026-09-29','08:15:00','21.4219','39.8276','2026-10-01 02:34:49','2026-10-01 02:34:49'),(424,21,'2026-09-29','12:00:00','21.4212','39.8264','2026-10-01 02:34:49','2026-10-01 02:34:49'),(425,21,'2026-09-29','16:45:00','21.4231','39.826','2026-10-01 02:34:49','2026-10-01 02:34:49'),(426,21,'2026-09-29','20:30:00','21.421','39.8271','2026-10-01 02:34:49','2026-10-01 02:34:49'),(427,21,'2026-09-30','04:30:00','21.4231','39.8283','2026-10-01 02:34:49','2026-10-01 02:34:49'),(428,21,'2026-09-30','08:15:00','21.4212','39.8284','2026-10-01 02:34:49','2026-10-01 02:34:49'),(429,21,'2026-09-30','12:00:00','21.4234','39.8263','2026-10-01 02:34:49','2026-10-01 02:34:49'),(430,21,'2026-09-30','16:45:00','21.4235','39.8285','2026-10-01 02:34:49','2026-10-01 02:34:49'),(431,21,'2026-09-30','20:30:00','21.4231','39.8275','2026-10-01 02:34:49','2026-10-01 02:34:49'),(432,21,'2026-10-01','04:30:00','21.4211','39.8259','2026-10-01 02:34:49','2026-10-01 02:34:49'),(433,21,'2026-10-01','08:15:00','21.4214','39.8264','2026-10-01 02:34:49','2026-10-01 02:34:49'),(434,21,'2026-10-01','12:00:00','21.422','39.8284','2026-10-01 02:34:49','2026-10-01 02:34:49'),(435,21,'2026-10-01','16:45:00','21.4211','39.8261','2026-10-01 02:34:49','2026-10-01 02:34:49'),(436,21,'2026-10-01','20:30:00','21.4226','39.8274','2026-10-01 02:34:49','2026-10-01 02:34:49'),(437,22,'2026-09-29','04:30:00','21.427','39.8242','2026-10-01 02:34:49','2026-10-01 02:34:49'),(438,22,'2026-09-29','08:15:00','21.4263','39.8248','2026-10-01 02:34:49','2026-10-01 02:34:49'),(439,22,'2026-09-29','12:00:00','21.427','39.8251','2026-10-01 02:34:49','2026-10-01 02:34:49'),(440,22,'2026-09-29','16:45:00','21.4265','39.8237','2026-10-01 02:34:49','2026-10-01 02:34:49'),(441,22,'2026-09-29','20:30:00','21.4273','39.8235','2026-10-01 02:34:49','2026-10-01 02:34:49'),(442,22,'2026-09-30','04:30:00','21.4269','39.8249','2026-10-01 02:34:49','2026-10-01 02:34:49'),(443,22,'2026-09-30','08:15:00','21.4268','39.8255','2026-10-01 02:34:49','2026-10-01 02:34:49'),(444,22,'2026-09-30','12:00:00','21.4259','39.8225','2026-10-01 02:34:49','2026-10-01 02:34:49'),(445,22,'2026-09-30','16:45:00','21.4267','39.8225','2026-10-01 02:34:49','2026-10-01 02:34:49'),(446,22,'2026-09-30','20:30:00','21.4274','39.825','2026-10-01 02:34:49','2026-10-01 02:34:49'),(447,22,'2026-10-01','04:30:00','21.4262','39.8251','2026-10-01 02:34:49','2026-10-01 02:34:49'),(448,22,'2026-10-01','08:15:00','21.4261','39.8229','2026-10-01 02:34:49','2026-10-01 02:34:49'),(449,22,'2026-10-01','12:00:00','21.4245','39.8254','2026-10-01 02:34:49','2026-10-01 02:34:49'),(450,22,'2026-10-01','16:45:00','21.4253','39.825','2026-10-01 02:34:49','2026-10-01 02:34:49'),(451,22,'2026-10-01','20:30:00','21.427','39.8248','2026-10-01 02:34:49','2026-10-01 02:34:49');
/*!40000 ALTER TABLE `position_jamaah` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `position_tour_leader`
--

DROP TABLE IF EXISTS `position_tour_leader`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `position_tour_leader` (
  `id_position_tour_leader` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_tl` bigint(20) unsigned NOT NULL,
  `tanggal` date NOT NULL,
  `waktu` time NOT NULL,
  `latitude` text NOT NULL,
  `longitude` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_position_tour_leader`),
  KEY `position_tour_leader_id_tl_foreign` (`id_tl`),
  CONSTRAINT `position_tour_leader_id_tl_foreign` FOREIGN KEY (`id_tl`) REFERENCES `tour_leader` (`id_tl`)
) ENGINE=InnoDB AUTO_INCREMENT=136 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `position_tour_leader`
--

LOCK TABLES `position_tour_leader` WRITE;
/*!40000 ALTER TABLE `position_tour_leader` DISABLE KEYS */;
INSERT INTO `position_tour_leader` VALUES (91,8,'2026-09-29','04:30:00','21.422487','39.826106','2026-10-01 02:34:49'),(92,8,'2026-09-29','08:15:00','21.422787','39.826706','2026-10-01 02:34:49'),(93,8,'2026-09-29','12:00:00','21.423387','39.827206','2026-10-01 02:34:49'),(94,8,'2026-09-29','16:45:00','21.421687','39.826106','2026-10-01 02:34:49'),(95,8,'2026-09-29','20:30:00','21.422987','39.825406','2026-10-01 02:34:49'),(96,8,'2026-09-30','04:30:00','21.422487','39.827006','2026-10-01 02:34:49'),(97,8,'2026-09-30','08:15:00','21.422987','39.825206','2026-10-01 02:34:49'),(98,8,'2026-09-30','12:00:00','21.422087','39.827106','2026-10-01 02:34:49'),(99,8,'2026-09-30','16:45:00','21.422087','39.826106','2026-10-01 02:34:49'),(100,8,'2026-09-30','20:30:00','21.422787','39.826606','2026-10-01 02:34:49'),(101,8,'2026-10-01','04:30:00','21.421487','39.827206','2026-10-01 02:34:49'),(102,8,'2026-10-01','08:15:00','21.422487','39.825406','2026-10-01 02:34:49'),(103,8,'2026-10-01','12:00:00','21.421587','39.826006','2026-10-01 02:34:49'),(104,8,'2026-10-01','16:45:00','21.423287','39.826106','2026-10-01 02:34:49'),(105,8,'2026-10-01','20:30:00','21.423187','39.826106','2026-10-01 02:34:49'),(106,9,'2026-09-29','04:30:00','21.425412','39.829245','2026-10-01 02:34:49'),(107,9,'2026-09-29','08:15:00','21.425512','39.828845','2026-10-01 02:34:49'),(108,9,'2026-09-29','12:00:00','21.425212','39.828445','2026-10-01 02:34:49'),(109,9,'2026-09-29','16:45:00','21.423912','39.827945','2026-10-01 02:34:49'),(110,9,'2026-09-29','20:30:00','21.424712','39.829445','2026-10-01 02:34:49'),(111,9,'2026-09-30','04:30:00','21.425912','39.828145','2026-10-01 02:34:49'),(112,9,'2026-09-30','08:15:00','21.424312','39.828645','2026-10-01 02:34:49'),(113,9,'2026-09-30','12:00:00','21.425712','39.827845','2026-10-01 02:34:49'),(114,9,'2026-09-30','16:45:00','21.425512','39.828445','2026-10-01 02:34:49'),(115,9,'2026-09-30','20:30:00','21.425312','39.827945','2026-10-01 02:34:49'),(116,9,'2026-10-01','04:30:00','21.424212','39.829645','2026-10-01 02:34:49'),(117,9,'2026-10-01','08:15:00','21.424512','39.829245','2026-10-01 02:34:49'),(118,9,'2026-10-01','12:00:00','21.424212','39.828545','2026-10-01 02:34:49'),(119,9,'2026-10-01','16:45:00','21.425612','39.829245','2026-10-01 02:34:49'),(120,9,'2026-10-01','20:30:00','21.425712','39.827645','2026-10-01 02:34:49'),(121,10,'2026-09-29','04:30:00','21.4191','39.8261','2026-10-01 02:34:49'),(122,10,'2026-09-29','08:15:00','21.4177','39.8264','2026-10-01 02:34:49'),(123,10,'2026-09-29','12:00:00','21.419','39.8249','2026-10-01 02:34:49'),(124,10,'2026-09-29','16:45:00','21.4189','39.8262','2026-10-01 02:34:49'),(125,10,'2026-09-29','20:30:00','21.4196','39.8249','2026-10-01 02:34:49'),(126,10,'2026-09-30','04:30:00','21.4192','39.8247','2026-10-01 02:34:49'),(127,10,'2026-09-30','08:15:00','21.4191','39.8255','2026-10-01 02:34:49'),(128,10,'2026-09-30','12:00:00','21.4195','39.8263','2026-10-01 02:34:49'),(129,10,'2026-09-30','16:45:00','21.4192','39.8261','2026-10-01 02:34:49'),(130,10,'2026-09-30','20:30:00','21.418','39.8249','2026-10-01 02:34:49'),(131,10,'2026-10-01','04:30:00','21.4185','39.8262','2026-10-01 02:34:49'),(132,10,'2026-10-01','08:15:00','21.4182','39.8247','2026-10-01 02:34:49'),(133,10,'2026-10-01','12:00:00','21.4182','39.8265','2026-10-01 02:34:49'),(134,10,'2026-10-01','16:45:00','21.4189','39.8255','2026-10-01 02:34:49'),(135,10,'2026-10-01','20:30:00','21.4188','39.826','2026-10-01 02:34:49');
/*!40000 ALTER TABLE `position_tour_leader` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prayer_session_participants`
--

DROP TABLE IF EXISTS `prayer_session_participants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `prayer_session_participants` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `prayer_session_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `joined_at` timestamp NULL DEFAULT NULL,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `left_at` timestamp NULL DEFAULT NULL,
  `duration_seconds` int(11) DEFAULT NULL,
  `status` enum('joined','left','disconnected','expired') NOT NULL DEFAULT 'joined',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `prayer_session_participants_prayer_session_id_user_id_unique` (`prayer_session_id`,`user_id`),
  KEY `prayer_session_participants_user_id_foreign` (`user_id`),
  CONSTRAINT `prayer_session_participants_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id_user`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prayer_session_participants`
--

LOCK TABLES `prayer_session_participants` WRITE;
/*!40000 ALTER TABLE `prayer_session_participants` DISABLE KEYS */;
/*!40000 ALTER TABLE `prayer_session_participants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prayer_sessions`
--

DROP TABLE IF EXISTS `prayer_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `prayer_sessions` (
  `id_prayer_session` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tour_id` bigint(20) unsigned NOT NULL,
  `group_id` bigint(20) unsigned NOT NULL,
  `leader_id` bigint(20) unsigned NOT NULL,
  `voice_room_id` bigint(20) unsigned NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `started_at` timestamp NULL DEFAULT NULL,
  `ended_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `current_content_id` bigint(20) unsigned DEFAULT NULL,
  `playlist` text DEFAULT NULL,
  `current_index` int(11) NOT NULL DEFAULT 0,
  `playback_state` varchar(255) NOT NULL DEFAULT 'stopped',
  `position_ms` int(11) NOT NULL DEFAULT 0,
  `speed` double NOT NULL DEFAULT 1,
  `volume` double NOT NULL DEFAULT 1,
  `version` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_prayer_session`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prayer_sessions`
--

LOCK TABLES `prayer_sessions` WRITE;
/*!40000 ALTER TABLE `prayer_sessions` DISABLE KEYS */;
INSERT INTO `prayer_sessions` VALUES (2,14,1,8,6,'PLAYING','2026-10-01 02:34:49',NULL,'2026-10-01 02:34:49','2026-10-01 02:34:49',1,'[{\"id\":1,\"title\":\"Talbiyah Labbaikallahumma Labbaik\",\"duration\":180000},{\"id\":2,\"title\":\"Doa Putaran 1 Thawaf\",\"duration\":240000},{\"id\":3,\"title\":\"Doa Minum Air Zamzam\",\"duration\":60000}]',0,'PLAYING',45000,1,0.85,1);
/*!40000 ALTER TABLE `prayer_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_videos`
--

DROP TABLE IF EXISTS `product_videos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `product_videos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL DEFAULT 'Video Produk',
  `video_path` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_videos`
--

LOCK TABLES `product_videos` WRITE;
/*!40000 ALTER TABLE `product_videos` DISABLE KEYS */;
INSERT INTO `product_videos` VALUES (1,'Video Panduan dan Fitur Ekosistem Jamaahku SAFF','https://www.w3schools.com/html/mov_bbb.mp4','2026-10-01 02:17:37','2026-10-01 02:17:37');
/*!40000 ALTER TABLE `product_videos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `province`
--

DROP TABLE IF EXISTS `province`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `province` (
  `id_province` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `province_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_province`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `province`
--

LOCK TABLES `province` WRITE;
/*!40000 ALTER TABLE `province` DISABLE KEYS */;
INSERT INTO `province` VALUES (1,'Nanggroe Aceh Darussalam','2026-08-13 01:14:15','2026-08-13 01:14:15'),(2,'Sumatera Utara','2026-08-13 01:14:15','2026-08-13 01:14:15'),(3,'Sumatera Selatan','2026-08-13 01:14:15','2026-08-13 01:14:15'),(4,'Sumatera Barat','2026-08-13 01:14:15','2026-08-13 01:14:15'),(5,'Bengkulu','2026-08-13 01:14:15','2026-08-13 01:14:15'),(6,'Riau','2026-08-13 01:14:15','2026-08-13 01:14:15'),(7,'Kepulauan Riau','2026-08-13 01:14:15','2026-08-13 01:14:15'),(8,'Jambi','2026-08-13 01:14:15','2026-08-13 01:14:15'),(9,'Lampung','2026-08-13 01:14:15','2026-08-13 01:14:15'),(10,'Bangka Belitung','2026-08-13 01:14:15','2026-08-13 01:14:15'),(11,'Kalimantan Barat','2026-08-13 01:14:15','2026-08-13 01:14:15'),(12,'Kalimantan Timur','2026-08-13 01:14:15','2026-08-13 01:14:15'),(13,'Kalimantan Selatan','2026-08-13 01:14:15','2026-08-13 01:14:15'),(14,'Kalimantan Tengah','2026-08-13 01:14:15','2026-08-13 01:14:15'),(15,'Kalimantan Utara','2026-08-13 01:14:15','2026-08-13 01:14:15'),(16,'Banten','2026-08-13 01:14:15','2026-08-13 01:14:15'),(17,'DKI Jakarta','2026-08-13 01:14:15','2026-08-13 01:14:15'),(18,'Jawa Barat','2026-08-13 01:14:15','2026-08-13 01:14:15'),(19,'Jawa Tengah','2026-08-13 01:14:15','2026-08-13 01:14:15'),(20,'Daerah Istimewa Yogyakarta','2026-08-13 01:14:15','2026-08-13 01:14:15'),(21,'Jawa Timur','2026-08-13 01:14:15','2026-08-13 01:14:15'),(22,'Bali','2026-08-13 01:14:15','2026-08-13 01:14:15'),(23,'Nusa Tenggara Timur','2026-08-13 01:14:15','2026-08-13 01:14:15'),(24,'Nusa Tenggara Barat','2026-08-13 01:14:15','2026-08-13 01:14:15'),(25,'Gorontalo','2026-08-13 01:14:15','2026-08-13 01:14:15'),(26,'Sulawesi Barat','2026-08-13 01:14:15','2026-08-13 01:14:15'),(27,'Sulawesi Tengah','2026-08-13 01:14:15','2026-08-13 01:14:15'),(28,'Sulawesi Utara','2026-08-13 01:14:15','2026-08-13 01:14:15'),(29,'Sulawesi Tenggara','2026-08-13 01:14:15','2026-08-13 01:14:15'),(30,'Sulawesi Selatan','2026-08-13 01:14:15','2026-08-13 01:14:15'),(31,'Maluku Utara','2026-08-13 01:14:15','2026-08-13 01:14:15'),(32,'Maluku','2026-08-13 01:14:15','2026-08-13 01:14:15'),(33,'Papua Barat','2026-08-13 01:14:15','2026-08-13 01:14:15'),(34,'Papua','2026-08-13 01:14:15','2026-08-13 01:14:15'),(35,'Papua Tengah','2026-08-13 01:14:15','2026-08-13 01:14:15'),(36,'Papua Pegunungan','2026-08-13 01:14:15','2026-08-13 01:14:15'),(37,'Papua Selatan','2026-08-13 01:14:15','2026-08-13 01:14:15'),(38,'Papua Barat Daya','2026-08-13 01:14:15','2026-08-13 01:14:15');
/*!40000 ALTER TABLE `province` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rating`
--

DROP TABLE IF EXISTS `rating`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rating` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_rating_categories` bigint(20) unsigned NOT NULL,
  `id_jamaah` bigint(20) unsigned NOT NULL,
  `id_ta` bigint(20) unsigned NOT NULL,
  `rating` int(11) NOT NULL,
  `comment` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `rating_id_rating_categories_foreign` (`id_rating_categories`),
  KEY `rating_id_jamaah_foreign` (`id_jamaah`),
  KEY `rating_id_ta_foreign` (`id_ta`),
  CONSTRAINT `rating_id_jamaah_foreign` FOREIGN KEY (`id_jamaah`) REFERENCES `jamaah` (`id_jamaah`) ON DELETE CASCADE,
  CONSTRAINT `rating_id_rating_categories_foreign` FOREIGN KEY (`id_rating_categories`) REFERENCES `rating_categories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rating_id_ta_foreign` FOREIGN KEY (`id_ta`) REFERENCES `travel_agent` (`id_ta`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rating`
--

LOCK TABLES `rating` WRITE;
/*!40000 ALTER TABLE `rating` DISABLE KEYS */;
INSERT INTO `rating` VALUES (1,1,13,14,5,'Pelayanan muthawif sangat sabar membimbing jamaah lansia, doa-doa dibacakan dengan jelas dan khusyuk.','2026-09-30 02:29:00','2026-09-30 02:29:00'),(2,2,14,14,5,'Aplikasi tracking lokasi sangat membantu keluarga di rumah memantau posisi kami tanpa cemas.','2026-09-29 02:29:00','2026-09-29 02:29:00'),(3,3,15,14,5,'Hotel sangat dekat dengan pelataran Masjidil Haram, kamar bersih dan makanan catering cocok.','2026-09-28 02:29:00','2026-09-28 02:29:00'),(4,1,16,14,5,'Pemberitahuan jadwal miqat dan ziarah via broadcast pesan sangat informatif dan tepat waktu.','2026-09-27 02:29:00','2026-09-27 02:29:00'),(5,2,17,14,5,'Pengalaman umrah terbaik bersama SAFF Travel! Sangat direkomendasikan untuk sanak saudara.','2026-09-26 02:29:00','2026-09-26 02:29:00');
/*!40000 ALTER TABLE `rating` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rating_categories`
--

DROP TABLE IF EXISTS `rating_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rating_categories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `category_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rating_categories`
--

LOCK TABLES `rating_categories` WRITE;
/*!40000 ALTER TABLE `rating_categories` DISABLE KEYS */;
INSERT INTO `rating_categories` VALUES (1,'Tour Leader','2026-08-13 01:14:15','2026-08-13 01:14:15',19),(2,'Travel Agent','2026-08-13 01:14:15','2026-08-13 01:14:15',19),(3,'Hotel','2026-08-13 01:14:15','2026-08-13 01:14:15',19);
/*!40000 ALTER TABLE `rating_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `roles` (
  `id_role` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nama_role` varchar(255) NOT NULL,
  `is_active` tinyint(1) NOT NULL,
  PRIMARY KEY (`id_role`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin',1),(2,'travel_agent',1),(3,'travel_agent_cabang',1),(4,'tour_leader',1),(5,'jamaah',1),(6,'mutawif',1),(7,'superadmin',1),(8,'family',1);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sos_radius_configs`
--

DROP TABLE IF EXISTS `sos_radius_configs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sos_radius_configs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_ta` bigint(20) unsigned NOT NULL,
  `id_batch` bigint(20) unsigned DEFAULT NULL COMMENT 'Null means global setting for TA',
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `radius_meter` int(11) NOT NULL DEFAULT 500,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sos_radius_configs_id_ta_id_batch_index` (`id_ta`,`id_batch`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sos_radius_configs`
--

LOCK TABLES `sos_radius_configs` WRITE;
/*!40000 ALTER TABLE `sos_radius_configs` DISABLE KEYS */;
INSERT INTO `sos_radius_configs` VALUES (1,14,11,1,500,'2026-10-01 02:29:00','2026-10-01 02:29:00');
/*!40000 ALTER TABLE `sos_radius_configs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `telescope_entries`
--

DROP TABLE IF EXISTS `telescope_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `telescope_entries` (
  `sequence` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(36) NOT NULL,
  `batch_id` char(36) NOT NULL,
  `family_hash` varchar(255) DEFAULT NULL,
  `should_display_on_index` tinyint(1) NOT NULL DEFAULT 1,
  `type` varchar(20) NOT NULL,
  `content` longtext NOT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`sequence`),
  UNIQUE KEY `telescope_entries_uuid_unique` (`uuid`),
  KEY `telescope_entries_batch_id_index` (`batch_id`),
  KEY `telescope_entries_family_hash_index` (`family_hash`),
  KEY `telescope_entries_created_at_index` (`created_at`),
  KEY `telescope_entries_type_should_display_on_index_index` (`type`,`should_display_on_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `telescope_entries`
--

LOCK TABLES `telescope_entries` WRITE;
/*!40000 ALTER TABLE `telescope_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `telescope_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `telescope_entries_tags`
--

DROP TABLE IF EXISTS `telescope_entries_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `telescope_entries_tags` (
  `entry_uuid` char(36) NOT NULL,
  `tag` varchar(255) NOT NULL,
  PRIMARY KEY (`entry_uuid`,`tag`),
  KEY `telescope_entries_tags_tag_index` (`tag`),
  CONSTRAINT `telescope_entries_tags_entry_uuid_foreign` FOREIGN KEY (`entry_uuid`) REFERENCES `telescope_entries` (`uuid`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `telescope_entries_tags`
--

LOCK TABLES `telescope_entries_tags` WRITE;
/*!40000 ALTER TABLE `telescope_entries_tags` DISABLE KEYS */;
/*!40000 ALTER TABLE `telescope_entries_tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `telescope_monitoring`
--

DROP TABLE IF EXISTS `telescope_monitoring`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `telescope_monitoring` (
  `tag` varchar(255) NOT NULL,
  PRIMARY KEY (`tag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `telescope_monitoring`
--

LOCK TABLES `telescope_monitoring` WRITE;
/*!40000 ALTER TABLE `telescope_monitoring` DISABLE KEYS */;
/*!40000 ALTER TABLE `telescope_monitoring` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `temp_batch_count`
--

DROP TABLE IF EXISTS `temp_batch_count`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `temp_batch_count` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `last_counter` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `temp_batch_count`
--

LOCK TABLES `temp_batch_count` WRITE;
/*!40000 ALTER TABLE `temp_batch_count` DISABLE KEYS */;
/*!40000 ALTER TABLE `temp_batch_count` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `testimonials`
--

DROP TABLE IF EXISTS `testimonials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `testimonials` (
  `id_testimonial` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `position` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_testimonial`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `testimonials`
--

LOCK TABLES `testimonials` WRITE;
/*!40000 ALTER TABLE `testimonials` DISABLE KEYS */;
INSERT INTO `testimonials` VALUES (1,'Hj. Siti Rahmawati, S.Pd','Jamaah Umrah Mandiri - Jakarta','Alhamdulillah selama berada di Makkah dan Madinah, anak saya di tanah air sangat tenang karena posisi saya selalu terpantau akurat di map. Smartwatch SAFF sangat ringan dan baterainya tahan berhari-hari.','https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop','2026-10-01 02:17:37','2026-10-01 02:17:37'),(2,'H. Bambang Hermawan','Direktur Utama Al-Anshar Tour & Travel','Dashboard QC & Tracking Jamaahku sangat mempermudah operasional kami. Muthawif tidak perlu panik saat ada jamaah terpisah dari rombongan saat tawaf ifadhah, cukup cek koordinat di aplikasi!','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop','2026-10-01 02:17:37','2026-10-01 02:17:37'),(3,'Ustadz Ahmad Fauzi, Lc','Tour Leader & Muthawif Bersertifikat','Fitur broadcast pesan suara dan panduan doa sangat membantu membimbing rombongan. Jamaah bisa membaca teks latin dan terjemahan langsung dengan antarmuka yang sangat jelas.','https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop','2026-10-01 02:17:37','2026-10-01 02:17:37');
/*!40000 ALTER TABLE `testimonials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tour_leader`
--

DROP TABLE IF EXISTS `tour_leader`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tour_leader` (
  `id_tl` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nik` varchar(255) NOT NULL,
  `id_ta` bigint(20) unsigned NOT NULL,
  `nama_tour_leader` varchar(255) NOT NULL,
  `photo` text NOT NULL COMMENT 'Image Path is point to public/pictures/tour-leader',
  `status` varchar(255) NOT NULL,
  `nama_pic` varchar(255) DEFAULT NULL,
  `effective_until` date DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `id_user` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id_tl`),
  KEY `tour_leader_id_user_foreign` (`id_user`),
  KEY `tour_leader_id_ta_foreign` (`id_ta`),
  CONSTRAINT `tour_leader_id_ta_foreign` FOREIGN KEY (`id_ta`) REFERENCES `travel_agent` (`id_ta`),
  CONSTRAINT `tour_leader_id_user_foreign` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tour_leader`
--

LOCK TABLES `tour_leader` WRITE;
/*!40000 ALTER TABLE `tour_leader` DISABLE KEYS */;
INSERT INTO `tour_leader` VALUES (8,'QC-PATCH-TL-NIK',14,'QC Patch TL','','1','QC Patch',NULL,1,'2026-09-29 04:45:27','2026-09-29 04:45:27',43),(9,'3201017549211819',14,'H. Ridwan Tour Leader','https://api.dicebear.com/7.x/initials/svg?seed=H.+Ridwan+Tour+Leader','active',NULL,NULL,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',48),(10,'3201011807762498',14,'Ustadz Farhan Mutawif 2','https://api.dicebear.com/7.x/initials/svg?seed=Ustadz+Farhan+Mutawif+2','active',NULL,NULL,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',49);
/*!40000 ALTER TABLE `tour_leader` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `traccar_webhook_receipts`
--

DROP TABLE IF EXISTS `traccar_webhook_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `traccar_webhook_receipts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `device_id` bigint(20) unsigned DEFAULT NULL,
  `kind` varchar(32) NOT NULL,
  `dedupe_key` varchar(191) NOT NULL,
  `payload_hash` varchar(64) DEFAULT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `received_at` timestamp NULL DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `traccar_receipts_kind_dedupe_unique` (`kind`,`dedupe_key`),
  KEY `traccar_webhook_receipts_device_id_kind_index` (`device_id`,`kind`),
  CONSTRAINT `traccar_webhook_receipts_device_id_foreign` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `traccar_webhook_receipts`
--

LOCK TABLES `traccar_webhook_receipts` WRITE;
/*!40000 ALTER TABLE `traccar_webhook_receipts` DISABLE KEYS */;
/*!40000 ALTER TABLE `traccar_webhook_receipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `travel_agent`
--

DROP TABLE IF EXISTS `travel_agent`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `travel_agent` (
  `id_ta` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code_ta` varchar(255) NOT NULL,
  `nama_travel_agent` varchar(255) NOT NULL,
  `contact_person` varchar(255) NOT NULL,
  `id_user` bigint(20) unsigned NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_approve` tinyint(1) NOT NULL DEFAULT 0,
  `is_rejected` tinyint(1) NOT NULL DEFAULT 0,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `pusat_ta_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id_ta`),
  UNIQUE KEY `travel_agent_code_ta_unique` (`code_ta`),
  KEY `travel_agent_id_user_foreign` (`id_user`),
  KEY `travel_agent_pusat_ta_id_foreign` (`pusat_ta_id`),
  CONSTRAINT `travel_agent_id_user_foreign` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`),
  CONSTRAINT `travel_agent_pusat_ta_id_foreign` FOREIGN KEY (`pusat_ta_id`) REFERENCES `travel_agent` (`id_ta`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `travel_agent`
--

LOCK TABLES `travel_agent` WRITE;
/*!40000 ALTER TABLE `travel_agent` DISABLE KEYS */;
INSERT INTO `travel_agent` VALUES (14,'QC-PATCH-TA','QC Patch Travel','QC Patch',42,1,1,0,NULL,'2026-09-29 04:45:07','2026-09-29 04:45:07',NULL);
/*!40000 ALTER TABLE `travel_agent` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_access`
--

DROP TABLE IF EXISTS `user_access`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_access` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_user` bigint(20) unsigned NOT NULL,
  `read` tinyint(1) NOT NULL DEFAULT 0,
  `create` tinyint(1) NOT NULL DEFAULT 0,
  `update` tinyint(1) NOT NULL DEFAULT 0,
  `delete` tinyint(1) NOT NULL DEFAULT 0,
  `module` varchar(255) NOT NULL,
  `created_by` int(11) NOT NULL,
  `updated_by` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_access_id_user_foreign` (`id_user`),
  CONSTRAINT `user_access_id_user_foreign` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_access`
--

LOCK TABLES `user_access` WRITE;
/*!40000 ALTER TABLE `user_access` DISABLE KEYS */;
INSERT INTO `user_access` VALUES (1,19,1,1,1,1,'jamaah',19,19,'2026-08-13 01:14:15','2026-08-13 01:14:15'),(2,19,1,1,1,1,'travel_agent',19,19,'2026-08-13 01:14:15','2026-08-13 01:14:15'),(3,19,1,1,1,1,'tour_leader',19,19,'2026-08-13 01:14:15','2026-08-13 01:14:15'),(4,19,1,1,1,1,'broadcast_pesan',19,19,'2026-08-13 01:14:15','2026-08-13 01:14:15');
/*!40000 ALTER TABLE `user_access` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_user` bigint(20) unsigned NOT NULL,
  `app_install_id` varchar(64) NOT NULL,
  `device_name` varchar(255) DEFAULT NULL,
  `platform` varchar(32) DEFAULT NULL,
  `app_type` varchar(32) NOT NULL,
  `app_version` varchar(32) DEFAULT NULL,
  `jwt_jti` varchar(255) DEFAULT NULL,
  `push_token` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `logged_in_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `revoked_reason` varchar(64) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_sessions_id_user_revoked_at_index` (`id_user`,`revoked_at`),
  KEY `user_sessions_id_user_app_install_id_index` (`id_user`,`app_install_id`),
  KEY `user_sessions_app_install_id_index` (`app_install_id`),
  KEY `user_sessions_jwt_jti_index` (`jwt_jti`),
  KEY `user_sessions_revoked_at_index` (`revoked_at`),
  CONSTRAINT `user_sessions_id_user_foreign` FOREIGN KEY (`id_user`) REFERENCES `users` (`id_user`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_sessions`
--

LOCK TABLES `user_sessions` WRITE;
/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id_user` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL COMMENT 'Username can be unique_code(ADMIN/TA) or number_whatsapp(TL/JAMAAH)',
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `password_text` text DEFAULT NULL,
  `nomor_telepon` varchar(18) NOT NULL,
  `keterangan` varchar(255) DEFAULT NULL,
  `id_role` bigint(20) unsigned NOT NULL,
  `is_approve` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'For Approved TA / Active User By Batch Time',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `id_ta` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id_user`),
  KEY `users_id_role_foreign` (`id_role`),
  KEY `users_id_ta_foreign` (`id_ta`),
  CONSTRAINT `users_id_role_foreign` FOREIGN KEY (`id_role`) REFERENCES `roles` (`id_role`),
  CONSTRAINT `users_id_ta_foreign` FOREIGN KEY (`id_ta`) REFERENCES `travel_agent` (`id_ta`)
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (19,'superadmin','superadmin@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','0800000000',NULL,7,1,1,'2026-08-13 01:14:16','2026-08-13 01:14:16',NULL),(20,'family','family@jamaahku.local','$2y$12$FfPEk3wHIq6cImdH.1HUVON.g.jfcmqcQP1ejEtvmvY5dYceR6JVq','eyJpdiI6Ill3ODR2dUVzdXlBbmczYk9mVWJkeWc9PSIsInZhbHVlIjoiUGUxeEtJU0pla2ZhSE9VaGR2RGZLdz09IiwibWFjIjoiMjQ0MDEyZDc4MWY0ZTI1MmQ5NjMwMWYzN2U5ZmEzOGE3MGIyZjlkZDQyN2I2NGFhMmY0YjMxYmFiMzM1NDAzOSIsInRhZyI6IiJ9','0800000001',NULL,8,1,1,'2026-08-13 01:14:17','2026-08-13 01:14:17',NULL),(42,'QC_PATCH_TA','qc_patch_ta@local.test','$2y$12$NeSrdOsX6fA1YO0cP1k1Cu6zCL3P4h/ceC.KbMen06gw8Li86ggS6','password123','0800000000',NULL,2,1,1,'2026-09-29 04:45:07','2026-09-29 04:45:07',14),(43,'0812345678','qc_patch_tl@local.test','',NULL,'0812345678',NULL,4,1,1,'2026-09-29 04:45:07','2026-09-29 04:45:07',NULL),(44,'081234567802','qc_patch_jamaah@local.test','',NULL,'081234567802',NULL,5,1,1,'2026-09-29 04:45:07','2026-09-29 04:45:07',NULL),(46,'+62 081288990011','sulaiman.alfarisi@example.com','$2y$12$6hteDFpitQqFrk.61zCcfesRLwj0Hq1D7WzVAuiC0QynfU/gl0j4q','eyJpdiI6IkhVcENZTG5RR3ZXVGVkbzNkeGw2S2c9PSIsInZhbHVlIjoidmxSZGdHZXJWSUFjWXRuY2IyNUp3QT09IiwibWFjIjoiNGFkYWFhNWY4NWI4YzdiMjY5MjVkYjc3NWZiMmY0ZmU0NTA3OWNiYWU1MDQ1ZGE2MWYwYjMzNzliYjg5ZGRlYyIsInRhZyI6IiJ9','+62 081288990011',NULL,6,0,1,'2026-09-29 08:58:50','2026-09-29 08:58:50',14),(47,'081111111111','muthawif01@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','081111111111',NULL,4,1,1,'2026-10-01 02:17:17','2026-10-01 02:17:17',14),(48,'082222222222','tourleader01@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','082222222222',NULL,4,1,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',14),(49,'0810000002','farhan.muthawif@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','0810000002',NULL,4,1,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',14),(50,'08310000001','jamaah1@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','08310000001',NULL,5,1,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',14),(51,'08310000002','jamaah2@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','08310000002',NULL,5,1,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',14),(52,'08310000003','jamaah3@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','08310000003',NULL,5,1,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',14),(53,'08310000004','jamaah4@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','08310000004',NULL,5,1,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',14),(54,'08310000005','jamaah5@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','08310000005',NULL,5,1,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',14),(55,'08310000006','jamaah6@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','08310000006',NULL,5,1,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',14),(56,'08310000007','jamaah7@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','08310000007',NULL,5,1,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',14),(57,'08310000008','jamaah8@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','08310000008',NULL,5,1,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',14),(58,'08310000009','jamaah9@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','08310000009',NULL,5,1,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',14),(59,'08310000010','jamaah10@jamaahku.local','$2y$12$jdpDqjk48HGPkD6I14i5Ce156URQcfMszqhfy50VFGCwuHIUcXRMC','123456','08310000010',NULL,5,1,1,'2026-10-01 02:17:37','2026-10-01 02:17:37',14);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `voice_raise_hands`
--

DROP TABLE IF EXISTS `voice_raise_hands`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `voice_raise_hands` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_voice_room` bigint(20) unsigned NOT NULL,
  `id_user` bigint(20) unsigned NOT NULL,
  `status` varchar(255) NOT NULL,
  `raised_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `approved_by` bigint(20) unsigned DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejected_by` bigint(20) unsigned DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `voice_raise_hands`
--

LOCK TABLES `voice_raise_hands` WRITE;
/*!40000 ALTER TABLE `voice_raise_hands` DISABLE KEYS */;
/*!40000 ALTER TABLE `voice_raise_hands` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `voice_room_audits`
--

DROP TABLE IF EXISTS `voice_room_audits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `voice_room_audits` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_voice_room` bigint(20) unsigned NOT NULL,
  `action` varchar(255) NOT NULL,
  `performed_by` bigint(20) unsigned NOT NULL,
  `target_user` bigint(20) unsigned DEFAULT NULL,
  `metadata` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `voice_room_audits`
--

LOCK TABLES `voice_room_audits` WRITE;
/*!40000 ALTER TABLE `voice_room_audits` DISABLE KEYS */;
/*!40000 ALTER TABLE `voice_room_audits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `voice_room_moderators`
--

DROP TABLE IF EXISTS `voice_room_moderators`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `voice_room_moderators` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_voice_room` bigint(20) unsigned NOT NULL,
  `id_user` bigint(20) unsigned NOT NULL,
  `role` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `voice_room_moderators`
--

LOCK TABLES `voice_room_moderators` WRITE;
/*!40000 ALTER TABLE `voice_room_moderators` DISABLE KEYS */;
/*!40000 ALTER TABLE `voice_room_moderators` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `voice_rooms`
--

DROP TABLE IF EXISTS `voice_rooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `voice_rooms` (
  `id_voice_room` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tour_id` bigint(20) unsigned DEFAULT NULL,
  `batch_id` bigint(20) unsigned DEFAULT NULL,
  `group_id` bigint(20) unsigned DEFAULT NULL,
  `physical_room_name` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'inactive',
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `ended_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_voice_room`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `voice_rooms`
--

LOCK TABLES `voice_rooms` WRITE;
/*!40000 ALTER TABLE `voice_rooms` DISABLE KEYS */;
INSERT INTO `voice_rooms` VALUES (6,14,1,1,'Audio Panduan Thawaf Kaaba','ACTIVE',1,'2026-10-01 02:34:49',NULL,'2026-10-01 02:34:49','2026-10-01 02:34:49'),(7,14,2,2,'Audio Panduan Ziarah Madinah','ACTIVE',1,'2026-10-01 02:34:49',NULL,'2026-10-01 02:34:49','2026-10-01 02:34:49');
/*!40000 ALTER TABLE `voice_rooms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `voice_speaker_permissions`
--

DROP TABLE IF EXISTS `voice_speaker_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `voice_speaker_permissions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_voice_room` bigint(20) unsigned NOT NULL,
  `id_user` bigint(20) unsigned NOT NULL,
  `granted_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `voice_speaker_permissions`
--

LOCK TABLES `voice_speaker_permissions` WRITE;
/*!40000 ALTER TABLE `voice_speaker_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `voice_speaker_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `watch_jamaah`
--

DROP TABLE IF EXISTS `watch_jamaah`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `watch_jamaah` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_jamaah` bigint(20) unsigned NOT NULL,
  `id_watch` bigint(20) unsigned NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `updated_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `watch_jamaah_id_jamaah_foreign` (`id_jamaah`),
  KEY `watch_jamaah_id_watch_foreign` (`id_watch`),
  CONSTRAINT `watch_jamaah_id_jamaah_foreign` FOREIGN KEY (`id_jamaah`) REFERENCES `jamaah` (`id_jamaah`),
  CONSTRAINT `watch_jamaah_id_watch_foreign` FOREIGN KEY (`id_watch`) REFERENCES `device_watch` (`id_watch`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `watch_jamaah`
--

LOCK TABLES `watch_jamaah` WRITE;
/*!40000 ALTER TABLE `watch_jamaah` DISABLE KEYS */;
INSERT INTO `watch_jamaah` VALUES (21,13,21,1,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(22,14,22,1,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(23,15,23,1,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(24,16,24,1,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(25,17,25,1,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(26,18,26,1,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(27,19,27,1,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(28,20,28,1,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(29,21,29,1,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48'),(30,22,30,1,NULL,NULL,'2026-10-01 02:34:48','2026-10-01 02:34:48');
/*!40000 ALTER TABLE `watch_jamaah` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `websockets_statistics_entries`
--

DROP TABLE IF EXISTS `websockets_statistics_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `websockets_statistics_entries` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `app_id` varchar(255) NOT NULL,
  `peak_connection_count` int(11) NOT NULL,
  `websocket_message_count` int(11) NOT NULL,
  `api_message_count` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `websockets_statistics_entries`
--

LOCK TABLES `websockets_statistics_entries` WRITE;
/*!40000 ALTER TABLE `websockets_statistics_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `websockets_statistics_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'jamaahku'
--

--
-- Current Database: `jamaahku`
--

USE `jamaahku`;

--
-- Final view structure for view `active_batch_room`
--

/*!50001 DROP VIEW IF EXISTS `active_batch_room`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `active_batch_room` AS select `brm`.`id_batch_room` AS `id_batch_room`,`brm`.`batch_room_code` AS `batch_room_code`,`brm`.`id_batch` AS `id_batch`,`brm`.`firestore_room_id` AS `firestore_room_id` from (`batch` `b` join `batch_room` `brm` on(`brm`.`id_batch` = `b`.`id_batch`)) where `b`.`is_active` = 1 */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `active_jamaah_batchroom`
--

/*!50001 DROP VIEW IF EXISTS `active_jamaah_batchroom`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `active_jamaah_batchroom` AS select `j`.`id_jamaah` AS `id_jamaah`,`j`.`nama_jamaah` AS `nama_jamaah`,`u`.`nomor_telepon` AS `nomor_telepon`,`j`.`created_at` AS `jamaah_created_at`,`j`.`is_active` AS `jamaah_is_active`,`b`.`tanggal_kepulangan` AS `tanggal_kepulangan`,`b`.`nama_batch` AS `nama_batch`,coalesce(`br`.`id_batch_room`,0) AS `id_batch_room`,`b`.`id_batch` AS `id_batch` from ((((`jamaah` `j` join `users` `u` on(`u`.`id_user` = `j`.`id_user`)) join `batch` `b` on(`b`.`id_batch` = `j`.`id_batch`)) left join `batch_room_list` `brl` on(`brl`.`id_jamaah` = `j`.`id_jamaah` and `brl`.`is_active` = 1)) left join `batch_room` `br` on(`br`.`id_batch_room` = `brl`.`id_batch_room` and `br`.`approve` = 1 and `br`.`is_active` = 1)) where `b`.`is_active` = 1 */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `chat_by_batch_room`
--

/*!50001 DROP VIEW IF EXISTS `chat_by_batch_room`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `chat_by_batch_room` AS select `lpr`.`id_room` AS `id_room`,`lpr`.`id_batch` AS `id_batch`,`lpr`.`id_jamaah` AS `id_jamaah`,`lpr`.`id_tl` AS `id_tl`,`lpr`.`id_user` AS `id_user`,`lpr`.`nama_user` AS `nama_user`,`lpr`.`photo` AS `photo`,`lpr`.`nomor_telepon` AS `nomor_telepon`,`lpr`.`is_mutawif` AS `is_mutawif`,`lpr`.`is_tl` AS `is_tl`,`b`.`nama_batch` AS `nama_batch`,`br`.`batch_room_code` AS `batch_room_code`,`b`.`tanggal_keberangkatan` AS `tanggal_keberangkatan`,`b`.`tanggal_kepulangan` AS `tanggal_kepulangan`,`dt`.`device_token` AS `device_token`,`dt`.`os` AS `os`,`wj`.`id` AS `id_watch_jamaah` from ((((`list_participant_room` `lpr` join `batch` `b` on(`b`.`id_batch` = `lpr`.`id_batch`)) join `batch_room` `br` on(`br`.`id_batch_room` = `lpr`.`id_room`)) left join `device_token` `dt` on(`dt`.`id_user` = `lpr`.`id_user`)) left join `watch_jamaah` `wj` on(`wj`.`id_jamaah` = `lpr`.`id_jamaah` and `wj`.`is_active` = 1)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `detail_group_chat_by_jamaah`
--

/*!50001 DROP VIEW IF EXISTS `detail_group_chat_by_jamaah`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `detail_group_chat_by_jamaah` AS select `j`.`id_jamaah` AS `id_jamaah`,`j`.`id_user` AS `id_user`,`j`.`nama_jamaah` AS `nama_jamaah`,`b`.`id_batch` AS `id_room`,`br`.`batch_room_code` AS `batch_room_code`,`b`.`id_batch` AS `id_batch`,`b`.`nama_batch` AS `nama_batch`,`b`.`tanggal_keberangkatan` AS `tanggal_keberangkatan`,`b`.`tanggal_kepulangan` AS `tanggal_kepulangan`,`ta`.`nama_travel_agent` AS `nama_travel_agent`,coalesce((select `tl2`.`nama_tour_leader` from (`batch_room_leader` `brl2` join `tour_leader` `tl2` on(`tl2`.`id_tl` = `brl2`.`id_tl`)) where `brl2`.`id_batch_room` = `br`.`id_batch_room` and `brl2`.`is_active` = 1 and `brl2`.`is_mutawif` = 0 limit 1),'-') AS `nama_tour_leader`,coalesce((select `tl3`.`nama_tour_leader` from (`batch_room_leader` `brl3` join `tour_leader` `tl3` on(`tl3`.`id_tl` = `brl3`.`id_tl`)) where `brl3`.`id_batch_room` = `br`.`id_batch_room` and `brl3`.`is_active` = 1 and `brl3`.`is_mutawif` = 1 limit 1),'-') AS `nama_mutawif` from ((((`batch_room_list` `brl` join `jamaah` `j` on(`j`.`id_jamaah` = `brl`.`id_jamaah`)) join `batch_room` `br` on(`br`.`id_batch_room` = `brl`.`id_batch_room`)) join `batch` `b` on(`b`.`id_batch` = `br`.`id_batch`)) join `travel_agent` `ta` on(`ta`.`id_ta` = `b`.`id_ta`)) where `br`.`approve` = 1 and `br`.`is_active` = 1 and `brl`.`is_active` = 1 and `j`.`is_active` = 1 and `b`.`is_active` = 1 */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `detail_group_chat_by_tl`
--

/*!50001 DROP VIEW IF EXISTS `detail_group_chat_by_tl`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `detail_group_chat_by_tl` AS select `tl`.`id_tl` AS `id_tl`,`tl`.`id_user` AS `id_user`,`b`.`id_batch` AS `id_room`,`br`.`batch_room_code` AS `batch_room_code`,`b`.`id_batch` AS `id_batch`,`b`.`nama_batch` AS `nama_batch`,`b`.`tanggal_keberangkatan` AS `tanggal_keberangkatan`,`b`.`tanggal_kepulangan` AS `tanggal_kepulangan`,`ta`.`nama_travel_agent` AS `nama_travel_agent`,coalesce((select `tl2`.`nama_tour_leader` from (`batch_room_leader` `brl2` join `tour_leader` `tl2` on(`tl2`.`id_tl` = `brl2`.`id_tl`)) where `brl2`.`id_batch_room` = `br`.`id_batch_room` and `brl2`.`is_active` = 1 and `brl2`.`is_mutawif` = 0 limit 1),'-') AS `nama_tour_leader`,coalesce((select `tl3`.`nama_tour_leader` from (`batch_room_leader` `brl3` join `tour_leader` `tl3` on(`tl3`.`id_tl` = `brl3`.`id_tl`)) where `brl3`.`id_batch_room` = `br`.`id_batch_room` and `brl3`.`is_active` = 1 and `brl3`.`is_mutawif` = 1 limit 1),'-') AS `nama_mutawif` from ((((`batch_room_leader` `brl` join `tour_leader` `tl` on(`tl`.`id_tl` = `brl`.`id_tl`)) join `batch_room` `br` on(`br`.`id_batch_room` = `brl`.`id_batch_room`)) join `batch` `b` on(`b`.`id_batch` = `br`.`id_batch`)) join `travel_agent` `ta` on(`ta`.`id_ta` = `b`.`id_ta`)) where `br`.`approve` = 1 and `br`.`is_active` = 1 and `brl`.`is_active` = 1 and `b`.`is_active` = 1 */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `draft_jamaah_batchroom`
--

/*!50001 DROP VIEW IF EXISTS `draft_jamaah_batchroom`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `draft_jamaah_batchroom` AS select `j`.`id_jamaah` AS `id_jamaah`,`j`.`nama_jamaah` AS `nama_jamaah`,`u`.`nomor_telepon` AS `nomor_telepon`,`j`.`created_at` AS `jamaah_created_at`,`j`.`is_active` AS `jamaah_is_active`,`b`.`tanggal_kepulangan` AS `tanggal_kepulangan`,`b`.`nama_batch` AS `nama_batch`,coalesce(`br`.`id_batch_room`,0) AS `id_batch_room`,`b`.`id_batch` AS `id_batch` from ((((`jamaah` `j` join `users` `u` on(`u`.`id_user` = `j`.`id_user`)) join `batch` `b` on(`b`.`id_batch` = `j`.`id_batch`)) left join `batch_room_list` `brl` on(`brl`.`id_jamaah` = `j`.`id_jamaah`)) left join `batch_room` `br` on(`br`.`id_batch_room` = `brl`.`id_batch_room`)) where `b`.`is_active` = 1 and `br`.`approve` = 0 */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `feedback_jamaah`
--

/*!50001 DROP VIEW IF EXISTS `feedback_jamaah`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `feedback_jamaah` AS select `r`.`id` AS `id`,`j`.`nama_jamaah` AS `nama_jamaah`,`ta`.`nama_travel_agent` AS `nama_travel_agent`,`r`.`comment` AS `comments`,`r`.`rating` AS `rating`,`r`.`created_at` AS `created_at`,`r`.`updated_at` AS `updated_at` from ((`rating` `r` left join `jamaah` `j` on(`j`.`id_jamaah` = `r`.`id_jamaah`)) left join `travel_agent` `ta` on(`ta`.`id_ta` = `r`.`id_ta`)) where `r`.`comment` is not null and `r`.`comment` <> '' */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `list_batch_room_by_tl`
--

/*!50001 DROP VIEW IF EXISTS `list_batch_room_by_tl`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `list_batch_room_by_tl` AS select `brl`.`id_tl` AS `pivot_id_tl`,`br`.`id_batch_room` AS `id_batch_room`,`br`.`batch_room_code` AS `batch_room_code`,`b`.`id_batch` AS `id_batch`,`b`.`nama_batch` AS `nama_batch`,`b`.`tanggal_keberangkatan` AS `tanggal_keberangkatan`,`b`.`tanggal_kepulangan` AS `tanggal_kepulangan` from ((`batch_room_leader` `brl` join `batch_room` `br` on(`br`.`id_batch_room` = `brl`.`id_batch_room`)) join `batch` `b` on(`b`.`id_batch` = `br`.`id_batch`)) where `b`.`is_active` = 1 and `br`.`approve` = 1 and `br`.`is_active` = 1 and `brl`.`is_active` = 1 */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `list_gps_jamaah`
--

/*!50001 DROP VIEW IF EXISTS `list_gps_jamaah`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `list_gps_jamaah` AS select `gj`.`id` AS `id`,`gj`.`id_jamaah` AS `id_jamaah`,`gj`.`id_gps` AS `id_gps`,`gj`.`created_at` AS `created_at`,`j`.`nama_jamaah` AS `nama_jamaah`,`dg`.`nama_perangkat` AS `nama_perangkat`,`dg`.`id_perangkat` AS `id_perangkat`,`b`.`id_batch` AS `id_batch`,`b`.`nama_batch` AS `nama_batch`,`ta`.`id_ta` AS `id_ta`,`ta`.`nama_travel_agent` AS `nama_travel_agent`,case when exists(select 1 from `log_gps` `lg` where `lg`.`id_gps` = `gj`.`id_gps` limit 1) then 1 else 0 end AS `have_log_data` from ((((`gps_jamaah` `gj` join `jamaah` `j` on(`j`.`id_jamaah` = `gj`.`id_jamaah`)) join `device_gps` `dg` on(`dg`.`id_gps` = `gj`.`id_gps`)) join `batch` `b` on(`b`.`id_batch` = `j`.`id_batch`)) join `travel_agent` `ta` on(`ta`.`id_ta` = `b`.`id_ta`)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `list_participant_room`
--

/*!50001 DROP VIEW IF EXISTS `list_participant_room`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `list_participant_room` AS select `brl`.`id_batch_room` AS `id_room`,`j`.`id_batch` AS `id_batch`,`j`.`id_jamaah` AS `id_jamaah`,NULL AS `id_tl`,`j`.`id_user` AS `id_user`,`j`.`nama_jamaah` AS `nama_user`,`u`.`nomor_telepon` AS `nomor_telepon`,`j`.`photo` AS `photo`,0 AS `is_mutawif`,0 AS `is_tl` from ((((`users` `u` join `jamaah` `j` on(`j`.`id_user` = `u`.`id_user`)) join `batch` `b` on(`b`.`id_batch` = `j`.`id_batch`)) join `batch_room_list` `brl` on(`brl`.`id_jamaah` = `j`.`id_jamaah`)) join `batch_room` `br` on(`br`.`id_batch_room` = `brl`.`id_batch_room`)) where `b`.`is_active` = 1 and `j`.`is_active` = 1 and `u`.`is_active` = 1 and `br`.`approve` = 1 and `br`.`is_active` = 1 and `brl`.`is_active` = 1 union all select `brl`.`id_batch_room` AS `id_room`,`br`.`id_batch` AS `id_batch`,NULL AS `id_jamaah`,`tl`.`id_tl` AS `id_tl`,`tl`.`id_user` AS `id_user`,`tl`.`nama_tour_leader` AS `nama_user`,`u`.`nomor_telepon` AS `nomor_telepon`,`tl`.`photo` AS `photo`,case when `brl`.`is_mutawif` = 1 then 1 else 0 end AS `is_mutawif`,1 AS `is_tl` from ((((`users` `u` join `tour_leader` `tl` on(`tl`.`id_user` = `u`.`id_user`)) join `batch_room_leader` `brl` on(`brl`.`id_tl` = `tl`.`id_tl`)) join `batch_room` `br` on(`br`.`id_batch_room` = `brl`.`id_batch_room`)) join `batch` `b` on(`b`.`id_batch` = `br`.`id_batch`)) where `b`.`is_active` = 1 and `tl`.`is_active` = 1 and `u`.`is_active` = 1 and `br`.`approve` = 1 and `br`.`is_active` = 1 and `brl`.`is_active` = 1 */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `login_data_jamaah`
--

/*!50001 DROP VIEW IF EXISTS `login_data_jamaah`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `login_data_jamaah` AS select `u`.`id_user` AS `id_user`,`u`.`username` AS `username`,`u`.`nomor_telepon` AS `nomor_telepon`,`u`.`id_role` AS `id_role`,`j`.`id_jamaah` AS `id_jamaah`,`j`.`nama_jamaah` AS `nama_jamaah`,`j`.`is_active` AS `is_active`,`b`.`id_batch` AS `id_batch`,`b`.`id_ta` AS `id_ta`,`b`.`id_ta` AS `id_ta_real`,`b`.`nama_batch` AS `nama_batch`,`b`.`tanggal_keberangkatan` AS `tanggal_keberangkatan`,`b`.`tanggal_kepulangan` AS `tanggal_kepulangan`,`br`.`id_batch_room` AS `id_batch_room`,case when `br`.`id_batch_room` is null then NULL when curdate() between `b`.`tanggal_keberangkatan` - interval 7 day and `b`.`tanggal_kepulangan` + interval 2 day and `b`.`is_active` = 1 and `br`.`approve` = 1 and `br`.`is_active` = 1 and `brl`.`is_active` = 1 then 1 else 0 end AS `is_batch_open`,greatest(1,abs(timestampdiff(MINUTE,current_timestamp(),concat(`b`.`tanggal_kepulangan`,' 23:59:59')))) AS `expired_token`,`ca`.`interval_time_tracking` AS `interval_time_tracking`,`ca`.`unique_code_batch` AS `unique_code_batch`,`ca`.`max_number_of_room` AS `max_number_of_room` from (((((`users` `u` join `jamaah` `j` on(`j`.`id_user` = `u`.`id_user`)) join `batch` `b` on(`b`.`id_batch` = `j`.`id_batch`)) left join `batch_room_list` `brl` on(`brl`.`id_jamaah` = `j`.`id_jamaah` and `brl`.`is_active` = 1)) left join `batch_room` `br` on(`br`.`id_batch_room` = `brl`.`id_batch_room`)) left join `config_app` `ca` on(`ca`.`id_ta` = `b`.`id_ta`)) where `u`.`id_role` in (5,6) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `login_data_tour_leader`
--

/*!50001 DROP VIEW IF EXISTS `login_data_tour_leader`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `login_data_tour_leader` AS select `u`.`id_user` AS `id_user`,`u`.`username` AS `username`,`u`.`nomor_telepon` AS `nomor_telepon`,`u`.`id_role` AS `id_role`,`tl`.`id_tl` AS `id_tl`,`tl`.`id_ta` AS `id_ta`,`tl`.`id_ta` AS `id_ta_real`,`tl`.`nama_tour_leader` AS `nama_tour_leader`,`tl`.`status` AS `status`,`tl`.`is_active` AS `is_active`,`ca`.`interval_time_tracking` AS `interval_time_tracking`,`ca`.`unique_code_batch` AS `unique_code_batch`,`ca`.`max_number_of_room` AS `max_number_of_room` from ((`users` `u` join `tour_leader` `tl` on(`tl`.`id_user` = `u`.`id_user`)) left join `config_app` `ca` on(`ca`.`id_ta` = `tl`.`id_ta`)) where `u`.`id_role` = 4 */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `mutawif_by_batch_room`
--

/*!50001 DROP VIEW IF EXISTS `mutawif_by_batch_room`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `mutawif_by_batch_room` AS select `brl`.`id_batch_room` AS `id_batch_room`,`brl`.`id_jamaah` AS `id_jamaah` from `batch_room_list` `brl` where `brl`.`is_mutawif` = 1 */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `mutowif_from_users`
--

/*!50001 DROP VIEW IF EXISTS `mutowif_from_users`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_unicode_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `mutowif_from_users` AS select `br`.`id_batch` AS `id_batch`,`tl`.`id_tl` AS `id_tl`,`tl`.`id_user` AS `id_user`,`tl`.`nama_tour_leader` AS `nama_mutawif` from ((`batch_room` `br` join `batch_room_leader` `brl` on(`brl`.`id_batch_room` = `br`.`id_batch_room`)) join `tour_leader` `tl` on(`tl`.`id_tl` = `brl`.`id_tl`)) where `brl`.`is_mutawif` = 1 and `br`.`approve` = 1 and `br`.`is_active` = 1 and `brl`.`is_active` = 1 */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-01 13:14:20
