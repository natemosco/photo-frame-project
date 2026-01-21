-- Add can_share_to_frame to users table
ALTER TABLE "users" ADD COLUMN "can_share_to_frame" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

-- Add is_locked to photos table
ALTER TABLE "photos" ADD COLUMN "is_locked" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

-- Remove frame_id from photos table (replaced by junction table)
ALTER TABLE "photos" DROP COLUMN "frame_id";
--> statement-breakpoint

-- Create frames table
CREATE TABLE "frames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create frame_photos junction table
CREATE TABLE "frame_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"frame_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "frame_photo_unique" UNIQUE("frame_id","photo_id")
);
--> statement-breakpoint

-- Add foreign key constraints
ALTER TABLE "frames" ADD CONSTRAINT "frames_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "frame_photos" ADD CONSTRAINT "frame_photos_frame_id_frames_id_fk" FOREIGN KEY ("frame_id") REFERENCES "public"."frames"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "frame_photos" ADD CONSTRAINT "frame_photos_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;
