/**
 * The Snuts — campaign config (proof-of-concept entry).
 *
 * Scanned from the connected Google Drive "The Snuts — All Content" folder via
 * the Drive MCP on 2026-06-02; expanded scan on 2026-06-17 adding Defibrillator
 * teaser/visualiser assets, album artwork, press images, and additional shorts.
 * 36 seed files total. BTS-heavy campaign shape with recording-session and vlog
 * footage, vertical cuts, one acoustic performance, teasers, a visualiser,
 * album artwork and press shots.
 */

import type { CampaignConfig } from '../campaignConfig';
import type { RawDriveFile } from '../driveAssets';

const FOLDER_URL =
  'https://drive.google.com/drive/folders/12bu-JmSvWfa-fgUUSm256o0GUToqWxhj';

const FILES: RawDriveFile[] = [
  // ── Recording BTS (12 files) ──
  { id: '1KQhL9J7aClLT2NraEOFQrrc5FBY0W5Ni', title: 'MIGRATION_SESSION_VLOG.mp4', mimeType: 'video/mp4', fileSize: '2480694855', modifiedTime: '2026-06-02T09:38:22.384Z', viewUrl: 'https://drive.google.com/file/d/1KQhL9J7aClLT2NraEOFQrrc5FBY0W5Ni/view', folderPath: 'Recording BTS' },
  { id: '1eDYJc56YtroWEhuEEbq27PgC8EGetBsj', title: 'GUGE_GRNMYR-FINAL-16x9.mp4', mimeType: 'video/mp4', fileSize: '1541628255', modifiedTime: '2026-06-02T08:30:39.534Z', viewUrl: 'https://drive.google.com/file/d/1eDYJc56YtroWEhuEEbq27PgC8EGetBsj/view', folderPath: 'Recording BTS' },
  { id: '1QG-D5KO17zbVmolJ8_pd7MFfXXMz6uOw', title: 'Posted_IG_SUMMER RAIN RECORDING 30TH MAY.mp4', mimeType: 'video/mp4', fileSize: '1172120545', modifiedTime: '2026-06-02T08:14:00.925Z', viewUrl: 'https://drive.google.com/file/d/1QG-D5KO17zbVmolJ8_pd7MFfXXMz6uOw/view', folderPath: 'Recording BTS' },
  { id: '1fcNSIwz-HKG3GkiHhNi9Buv1Rfqgy5lC', title: 'PTS_GREENMYRE FARM RECORDING SESSION #2.mp4', mimeType: 'video/mp4', fileSize: '707245780', modifiedTime: '2026-06-02T08:14:20.963Z', viewUrl: 'https://drive.google.com/file/d/1fcNSIwz-HKG3GkiHhNi9Buv1Rfqgy5lC/view', folderPath: 'Recording BTS' },
  { id: '1OI7lIDwfsVcyTbpcIGaxzXXApdbkcnmy', title: 'COUNTRY MUSIC SUBTITLED.mp4', mimeType: 'video/mp4', fileSize: '245045023', modifiedTime: '2026-06-01T12:03:20.504Z', viewUrl: 'https://drive.google.com/file/d/1OI7lIDwfsVcyTbpcIGaxzXXApdbkcnmy/view', folderPath: 'Recording BTS' },
  { id: '1P0XxJopQF2QvO5kHmORqlgtOKqqYxd-J', title: 'DAY 2 MIGRATION.mp4', mimeType: 'video/mp4', fileSize: '348999732', modifiedTime: '2026-06-01T11:54:32.536Z', viewUrl: 'https://drive.google.com/file/d/1P0XxJopQF2QvO5kHmORqlgtOKqqYxd-J/view', folderPath: 'Recording BTS' },
  { id: '1sGllEdP7WccaLKpnYqXd9bMbxtYN4d5V', title: 'DAY 5 MIGRATION.mp4', mimeType: 'video/mp4', fileSize: '1735013221', modifiedTime: '2026-06-01T12:00:27.108Z', viewUrl: 'https://drive.google.com/file/d/1sGllEdP7WccaLKpnYqXd9bMbxtYN4d5V/view', folderPath: 'Recording BTS' },
  { id: '1zwyuTvfTwhHvIlcZTT1E0vFjzT6OEOU3', title: 'DAY 4 MIGRATION.mp4', mimeType: 'video/mp4', fileSize: '1581319115', modifiedTime: '2026-06-01T12:00:47.141Z', viewUrl: 'https://drive.google.com/file/d/1zwyuTvfTwhHvIlcZTT1E0vFjzT6OEOU3/view', folderPath: 'Recording BTS' },
  { id: '1z6UvBaZXALjXm8MeuJ4aZTZcVTa3zGB5', title: 'summer rain guitars & jacks pep talk SUBBED .mp4', mimeType: 'video/mp4', fileSize: '89111364', modifiedTime: '2026-06-01T12:03:52.713Z', viewUrl: 'https://drive.google.com/file/d/1z6UvBaZXALjXm8MeuJ4aZTZcVTa3zGB5/view', folderPath: 'Recording BTS' },
  { id: '1kXutnF17H5tZoWnor4Hji8Vuh68tbJYf', title: 'DAY 6 MIGRATION.mp4', mimeType: 'video/mp4', fileSize: '2281089878', modifiedTime: '2026-06-01T12:02:41.316Z', viewUrl: 'https://drive.google.com/file/d/1kXutnF17H5tZoWnor4Hji8Vuh68tbJYf/view', folderPath: 'Recording BTS' },
  { id: '1VzmwSdVtnnxeTa2Lplmyui30VJVGQ6Ty', title: 'DAY 3 .mp4', mimeType: 'video/mp4', fileSize: '2314530177', modifiedTime: '2026-06-01T12:02:48.772Z', viewUrl: 'https://drive.google.com/file/d/1VzmwSdVtnnxeTa2Lplmyui30VJVGQ6Ty/view', folderPath: 'Recording BTS' },
  { id: '1hE3ZrptIVt2CxhsO7BfefrgUAe0xHoH4', title: 'GREENMYRE BOYS BUILD STUDIO.mp4', mimeType: 'video/mp4', fileSize: '1327895069', modifiedTime: '2026-06-01T11:24:32.279Z', viewUrl: 'https://drive.google.com/file/d/1hE3ZrptIVt2CxhsO7BfefrgUAe0xHoH4/view', folderPath: 'Recording BTS' },

  // ── Shorts / Studio BTS (4 files) ──
  { id: '1VnPIpYX9q0NHSjW6O0DYJgME_NeVQQlW', title: 'C1_Migration_.mp4', mimeType: 'video/mp4', fileSize: '40089400', modifiedTime: '2026-06-02T09:31:11.624Z', viewUrl: 'https://drive.google.com/file/d/1VnPIpYX9q0NHSjW6O0DYJgME_NeVQQlW/view', folderPath: 'Shorts / Studio BTS' },
  { id: '1bxIXNt77ij7rgEmGNSg9OwLl0lX7Pvkj', title: 'C4_Migration.mp4', mimeType: 'video/mp4', fileSize: '29177976', modifiedTime: '2026-06-02T09:35:48.545Z', viewUrl: 'https://drive.google.com/file/d/1bxIXNt77ij7rgEmGNSg9OwLl0lX7Pvkj/view', folderPath: 'Shorts / Studio BTS' },
  { id: '1CFgCfjJL9s9xISv5kBZGvVtnihgTYYgZ', title: 'C5_Migration.mp4', mimeType: 'video/mp4', fileSize: '27936482', modifiedTime: '2026-06-02T09:36:51.175Z', viewUrl: 'https://drive.google.com/file/d/1CFgCfjJL9s9xISv5kBZGvVtnihgTYYgZ/view', folderPath: 'Shorts / Studio BTS' },
  { id: '1MHlB5ItzIO-ItVURVtM-HRk2cwGxeTeL', title: 'C6_Migration.mp4', mimeType: 'video/mp4', fileSize: '31086691', modifiedTime: '2026-06-02T09:37:55.116Z', viewUrl: 'https://drive.google.com/file/d/1MHlB5ItzIO-ItVURVtM-HRk2cwGxeTeL/view', folderPath: 'Shorts / Studio BTS' },

  // ── Teasers (1 file) ──
  { id: '1HCFTbFd2k6ldwuNc1BiQ_pTgqUq7Sna1', title: 'Defibrillator_Teaser2.mov', mimeType: 'video/quicktime', fileSize: '25457737', modifiedTime: '2026-06-10T09:55:05Z', viewUrl: 'https://drive.google.com/file/d/1HCFTbFd2k6ldwuNc1BiQ_pTgqUq7Sna1/view', folderPath: 'Shorts / Teasers' },

  // ── Visualiser (1 file) ──
  { id: '1L7lJh-xZod5rk9HfPyljKSWfYVOpTu7S', title: 'Defibrillator_Visualiser_4K_PRORES.mov', mimeType: 'video/quicktime', fileSize: '13918795526', modifiedTime: '2026-06-10T10:09:43Z', viewUrl: 'https://drive.google.com/file/d/1L7lJh-xZod5rk9HfPyljKSWfYVOpTu7S/view', folderPath: 'Shorts / Visualiser' },

  // ── Performance Videos (1 file) ──
  { id: '1Vz5Fm9S6G1UQ5zPOSzH_7Phl5eAOufiK', title: 'SUMMER_RAIN_ACOUSTIC_MIGRATION (1).mp4', mimeType: 'video/mp4', fileSize: '1053386480', modifiedTime: '2026-06-01T11:31:58.097Z', viewUrl: 'https://drive.google.com/file/d/1Vz5Fm9S6G1UQ5zPOSzH_7Phl5eAOufiK/view', folderPath: 'Performance Videos' },

  // ── Live Vlogs (Archive) (4 files) ──
  { id: '1BN9JyJxYX5PlTkl1OfmcL2Vr5oVdhvt7', title: 'DAY IN THE LIFE - INHALER.mp4', mimeType: 'video/mp4', fileSize: '602042866', modifiedTime: '2026-06-01T12:45:19.767Z', viewUrl: 'https://drive.google.com/file/d/1BN9JyJxYX5PlTkl1OfmcL2Vr5oVdhvt7/view', folderPath: 'Live Vlogs' },
  { id: '1MxIDusgaF88okgZBFzo9Uhyml4G_lsRL', title: 'BANDYCAM EPISODE #1 HYDRO.mp4', mimeType: 'video/mp4', fileSize: '147125729', modifiedTime: '2026-06-01T12:05:43.287Z', viewUrl: 'https://drive.google.com/file/d/1MxIDusgaF88okgZBFzo9Uhyml4G_lsRL/view', folderPath: 'Live Vlogs' },
  { id: '13cMHku2J1DThw_pItwC87hzCiujKHJ8Z', title: 'Barras_N1.mp4', mimeType: 'video/mp4', fileSize: '235680927', modifiedTime: '2025-07-25T13:09:43.034Z', viewUrl: 'https://drive.google.com/file/d/13cMHku2J1DThw_pItwC87hzCiujKHJ8Z/view', folderPath: 'Live Vlogs' },
  { id: '1FDnMz95YPuC2wiuugrVfLqgVfw19NOQv', title: 'Barras_N3.mp4', mimeType: 'video/mp4', fileSize: '170434153', modifiedTime: '2025-07-25T13:11:12.023Z', viewUrl: 'https://drive.google.com/file/d/1FDnMz95YPuC2wiuugrVfLqgVfw19NOQv/view', folderPath: 'Live Vlogs' },

  // ── Album Artwork (2 files) ──
  { id: '1vvdFjxh1gK1ddAr2w5UlOHz8iz0YbHAZ', title: 'JoyInShortMoments_FRONTCOVER.tif', mimeType: 'image/tiff', fileSize: '509324548', modifiedTime: '2026-05-22T10:08:32Z', viewUrl: 'https://drive.google.com/file/d/1vvdFjxh1gK1ddAr2w5UlOHz8iz0YbHAZ/view', folderPath: 'Album Artwork' },
  { id: '1o6XxXguB_9dVuuV7d9JxqmPXpqb0MlZZ', title: 'JoyInShortMoments_FRONTCOVER.jpg', mimeType: 'image/jpeg', fileSize: '5553002', modifiedTime: '2026-05-22T10:08:33Z', viewUrl: 'https://drive.google.com/file/d/1o6XxXguB_9dVuuV7d9JxqmPXpqb0MlZZ/view', folderPath: 'Album Artwork' },

  // ── Press Images (11 files) ──
  { id: '1-LiYuoaRi2GhF-XBaxOFfGD5IrFzaKzO', title: '1_PRESSSHOT_SamMcGill.jpg', mimeType: 'image/jpeg', fileSize: '40884461', modifiedTime: '2026-06-05T11:33:47.755Z', viewUrl: 'https://drive.google.com/file/d/1-LiYuoaRi2GhF-XBaxOFfGD5IrFzaKzO/view', folderPath: 'Press Images' },
  { id: '1lsAVX2WM_8D6p8eb6HObsIbhkMlOLmNX', title: '2_Socials_SamMcGill.jpg', mimeType: 'image/jpeg', fileSize: '37136313', modifiedTime: '2026-06-05T11:34:08.013Z', viewUrl: 'https://drive.google.com/file/d/1lsAVX2WM_8D6p8eb6HObsIbhkMlOLmNX/view', folderPath: 'Press Images' },
  { id: '1njYbh_2B_S76C2rgnj9csFBQAGB1UZjm', title: 'Snuts_SWG3PressShoot_SamMcGill-11.jpg', mimeType: 'image/jpeg', fileSize: '29136873', modifiedTime: '2026-06-04T19:45:48Z', viewUrl: 'https://drive.google.com/file/d/1njYbh_2B_S76C2rgnj9csFBQAGB1UZjm/view', folderPath: 'Press Images' },
  { id: '1bbC7q8ESLfOJhBOnBgcVqAo693NODe73', title: 'Snuts_SWG3PressShoot_SamMcGill-10.jpg', mimeType: 'image/jpeg', fileSize: '36537517', modifiedTime: '2026-06-04T19:45:48Z', viewUrl: 'https://drive.google.com/file/d/1bbC7q8ESLfOJhBOnBgcVqAo693NODe73/view', folderPath: 'Press Images' },
  { id: '1IKAuvDS-FtonwnJyv4fxwbc3aKn-UeHK', title: 'Snuts_SWG3PressShoot_SamMcGill-13.jpg', mimeType: 'image/jpeg', fileSize: '36135670', modifiedTime: '2026-06-04T19:45:48Z', viewUrl: 'https://drive.google.com/file/d/1IKAuvDS-FtonwnJyv4fxwbc3aKn-UeHK/view', folderPath: 'Press Images' },
  { id: '1nECybWzfzFxDCiLwdWYz9nwnYK5TPH05', title: 'Snuts_SWG3PressShoot_SamMcGill-20.jpg', mimeType: 'image/jpeg', fileSize: '37136313', modifiedTime: '2026-06-04T19:45:48Z', viewUrl: 'https://drive.google.com/file/d/1nECybWzfzFxDCiLwdWYz9nwnYK5TPH05/view', folderPath: 'Press Images' },
  { id: '1HEvgpNkn0JNv0WQp4oICAo4F0YinDUgp', title: 'Snuts_SWG3PressShoot_SamMcGill-3.jpg', mimeType: 'image/jpeg', fileSize: '34675569', modifiedTime: '2026-06-04T19:45:48Z', viewUrl: 'https://drive.google.com/file/d/1HEvgpNkn0JNv0WQp4oICAo4F0YinDUgp/view', folderPath: 'Press Images' },
  { id: '15zJ_-o08YIOc27A8SBcjiRUNZRriICwB', title: 'Snuts_SWG3PressShoot_SamMcGill-19.jpg', mimeType: 'image/jpeg', fileSize: '47525092', modifiedTime: '2026-06-04T19:45:48Z', viewUrl: 'https://drive.google.com/file/d/15zJ_-o08YIOc27A8SBcjiRUNZRriICwB/view', folderPath: 'Press Images' },
  { id: '1HChIJSkr9ZDv-V9jgDQXx45dVIR486aj', title: 'Snuts_SWG3PressShoot_SamMcGill-2.jpg', mimeType: 'image/jpeg', fileSize: '33976861', modifiedTime: '2026-06-04T19:45:48Z', viewUrl: 'https://drive.google.com/file/d/1HChIJSkr9ZDv-V9jgDQXx45dVIR486aj/view', folderPath: 'Press Images' },
  { id: '11EcxY4k06-pn9EFczuAK3CnGmiQtRYou', title: 'Snuts_SWG3PressShoot_SamMcGill-14.jpg', mimeType: 'image/jpeg', fileSize: '36275500', modifiedTime: '2026-06-04T19:45:48Z', viewUrl: 'https://drive.google.com/file/d/11EcxY4k06-pn9EFczuAK3CnGmiQtRYou/view', folderPath: 'Press Images' },
  { id: '1XHJZef6ZM_jmx5aOCKEV_fzTzZiO7JoY', title: 'Snuts_SWG3PressShoot_SamMcGill.jpg', mimeType: 'image/jpeg', fileSize: '36620565', modifiedTime: '2026-06-04T19:45:48Z', viewUrl: 'https://drive.google.com/file/d/1XHJZef6ZM_jmx5aOCKEV_fzTzZiO7JoY/view', folderPath: 'Press Images' },
];

export const SNUTS_CONFIG: CampaignConfig = {
  slug: 'the-snuts-the-snuts-campaign',
  artist: 'The Snuts',
  driveFolderUrl: FOLDER_URL,
  driveFolderName: 'The Snuts — All Content',
  seedFolderId: '12bu-JmSvWfa-fgUUSm256o0GUToqWxhj',
  seedScannedAt: '2026-06-17T12:00:00.000Z',
  seedAssetFiles: FILES,
  knownReleases: [
    { title: 'Summer Rain', type: 'single' },
    { title: 'Motherlands', type: 'single' },
    { title: 'Defibrillator', type: 'single' },
    { title: 'Joy In Short Moments', type: 'album' },
  ],
  campaignMilestones: [
    { label: 'Summer Rain — single', kind: 'singleRelease' },
    { label: 'Migration — album', kind: 'albumRelease' },
  ],
  // BTS-heavy campaign: standard release expectations are fine — we want the
  // score to honestly flag the missing official video + artwork.
};
