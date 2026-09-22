-- CreateTable
CREATE TABLE "travel_reminders" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "client_name" TEXT,
    "client_phone" TEXT,
    "client_email" TEXT,
    "passenger_name" TEXT NOT NULL,
    "passenger_doc" TEXT,
    "route" TEXT NOT NULL,
    "airline" TEXT,
    "flight_number" TEXT,
    "ticket_number" TEXT,
    "departure_date" DATE NOT NULL,
    "departure_time" TEXT,
    "return_date" DATE,
    "return_time" TEXT,
    "has_return" BOOLEAN NOT NULL DEFAULT false,
    "hotel_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROGRAMADO',
    "observations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "travel_reminders_departure_date_idx" ON "travel_reminders"("departure_date");
