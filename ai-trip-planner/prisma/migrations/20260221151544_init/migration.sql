-- CreateTable
CREATE TABLE `cities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `image_url` TEXT NULL,
    `created_at` DATETIME(3) NULL,

    UNIQUE INDEX `cities_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `place_images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `place_id` INTEGER NOT NULL,
    `image_url` TEXT NOT NULL,
    `is_primary` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `place_id`(`place_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `places` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `city_id` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` ENUM('attraction', 'restaurant', 'hidden_gem', 'bar', 'cafe', 'activity') NOT NULL,
    `category` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `google_maps_url` TEXT NULL,
    `rating` DECIMAL(2, 1) NULL,
    `review_count` INTEGER NULL,
    `price_level` TINYINT NULL,
    `average_cost` INTEGER NULL,
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `area` VARCHAR(150) NULL,
    `is_featured` BOOLEAN NULL DEFAULT false,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `city_id`(`city_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itineraries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `city_id` INTEGER NOT NULL,
    `budget` INTEGER NOT NULL,
    `duration` INTEGER NOT NULL,
    `persons` INTEGER NOT NULL,
    `themes` VARCHAR(191) NOT NULL,
    `json_data` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stays` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `city_id` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `area` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `rating` DOUBLE NULL,
    `review_count` INTEGER NULL,
    `cleanliness_score` DOUBLE NULL,
    `price_per_night` INTEGER NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `google_maps_url` TEXT NULL,
    `photo_reference` TEXT NULL,
    `image_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stays_city_id_name_key`(`city_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `place_images` ADD CONSTRAINT `place_images_ibfk_1` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `places` ADD CONSTRAINT `places_ibfk_1` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `itineraries` ADD CONSTRAINT `itineraries_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stays` ADD CONSTRAINT `stays_city_id_fkey` FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
