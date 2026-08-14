import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * An owner-uploaded post image, stored in the DATABASE and served at a public URL.
 *
 * Why the DB and not object storage: this deployment has none, and every publish platform
 * except Telegram ingests images by URL — so uploaded bytes must live somewhere a public
 * endpoint can read them after any restart. Uploads are recompressed to a bounded JPEG
 * before storage (see the controller), so a row is a few hundred KB, and uploads are an
 * occasional manual act, not a firehose.
 */
@Entity('uploaded_images')
export class UploadedImage {
  /** Unguessable id — it IS the access control on the public serving URL. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column({ type: 'bytea' })
  data: Buffer;

  @Column({ default: 'image/jpeg' })
  mime: string;

  @CreateDateColumn()
  created_at: Date;
}
