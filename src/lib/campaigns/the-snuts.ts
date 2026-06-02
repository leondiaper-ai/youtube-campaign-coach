/**
 * The Snuts — campaign config (proof-of-concept entry).
 *
 * Scanned from the connected Google Drive "The Snuts — All Content" folder via
 * the Drive MCP on 2026-06-02. This is a BTS-heavy campaign shape: lots of
 * recording-session and vlog footage, vertical cuts, one acoustic performance
 * and an audio master — but no official video or artwork yet. A good test of
 * the readiness score NOT over-crediting raw footage.
 */

import type { CampaignConfig } from '../campaignConfig';
import type { RawDriveFile } from '../driveAssets';

const FOLDER_URL =
  'https://drive.google.com/drive/folders/12bu-JmSvWfa-fgUUSm256o0GUToqWxhj';

const FILES: RawDriveFile[] = [
  // ── Recording BTS ──
  { id: '1KQhL9J7aClLT2NraEOFQrrc5FBY0W5Ni', title: 'MIGRATION_SESSION_VLOG.mp4', mimeType: 'video/mp4', fileSize: '2480694855', modifiedTime: '2026-06-02T09:38:22.384Z', viewUrl: 'https://drive.google.com/file/d/1KQhL9J7aClLT2NraEOFQrrc5FBY0W5Ni/view', folderPath: 'Recording BTS' },
  { id: '1eDYJc56YtroWEhuEEbq27PgC8EGetBsj', title: 'GUGE_GRNMYR-FINAL-16x9.mp4', mimeType: 'video/mp4', fileSize: '1541628255', modifiedTime: '2026-06-02T08:30:39.534Z', viewUrl: 'https://drive.google.com/file/d/1eDYJc56YtroWEhuEEbq27PgC8EGetBsj/view', folderPath: 'Recording BTS' },
  { id: '1QG-D5KO17zbVmolJ8_pd7MFfXXMz6uOw', title: 'Posted_IG_SUMMER RAIN RECORDING 30TH MAY.mp4', mimeType: 'video/mp4', fileSize: '1172120545', modifiedTime: '2026-06-02T08:14:00.925Z', viewUrl: 'https://drive.google.com/file/d/1QG-D5KO17zbVmolJ8_pd7MFfXXMz6uOw/view', folderPath: 'Recording BTS' },
  { id: '1fcNSIwz-HKG3GkiHhNi9Buv1Rfqgy5lC', title: 'PTS_GREENMYRE FARM RECORDING SESSION #2.mp4', mimeType: 'video/mp4', fileSize: '707245780', modifiedTime: '2026-06-02T08:14:20.963Z', viewUrl: 'https://drive.google.com/file/d/1fcNSIwz-HKG3GkiHhNi9Buv1Rfqgy5lC/view', folderPath: 'Recording BTS' },
  { id: '1P0XxJopQF2QvO5kHmORqlgtOKqqYxd-J', title: 'DAY 2 MIGRATION.mp4', mimeType: 'video/mp4', fileSize: '348999732', modifiedTime: '2026-06-01T11:54:32.536Z', viewUrl: 'https://drive.google.com/file/d/1P0XxJopQF2QvO5kHmORqlgtOKqqYxd-J/view', folderPath: 'Recording BTS' },
  { id: '1kXutnF17H5tZoWnor4Hji8Vuh68tbJYf', title: 'DAY 6 MIGRATION.mp4', mimeType: 'video/mp4', fileSize: '2281089878', modifiedTime: '2026-06-01T12:02:41.316Z', viewUrl: 'https://drive.google.com/file/d/1kXutnF17H5tZoWnor4Hji8Vuh68tbJYf/view', folderPath: 'Recording BTS' },
  { id: '1VzmwSdVtnnxeTa2Lplmyui30VJVGQ6Ty', title: 'DAY 3 .mp4', mimeType: 'video/mp4', fileSize: '2314530177', modifiedTime: '2026-06-01T12:02:48.772Z', viewUrl: 'https://drive.google.com/file/d/1VzmwSdVtnnxeTa2Lplmyui30VJVGQ6Ty/view', folderPath: 'Recording BTS' },
  { id: '1sGllEdP7WccaLKpnYqXd9bMbxtYN4d5V', title: 'DAY 5 MIGRATION.mp4', mimeType: 'video/mp4', fileSize: '1735013221', modifiedTime: '2026-06-01T12:00:27.108Z', viewUrl: 'https://drive.google.com/file/d/1sGllEdP7WccaLKpnYqXd9bMbxtYN4d5V/view', folderPath: 'Recording BTS' },
  { id: '1z6UvBaZXALjXm8MeuJ4aZTZcVTa3zGB5', title: 'summer rain guitars & jacks pep talk SUBBED .mp4', mimeType: 'video/mp4', fileSize: '89111364', modifiedTime: '2026-06-01T12:03:52.713Z', viewUrl: 'https://drive.google.com/file/d/1z6UvBaZXALjXm8MeuJ4aZTZcVTa3zGB5/view', folderPath: 'Recording BTS' },
  { id: '1zwyuTvfTwhHvIlcZTT1E0vFjzT6OEOU3', title: 'DAY 4 MIGRATION.mp4', mimeType: 'video/mp4', fileSize: '1581319115', modifiedTime: '2026-06-01T12:00:47.141Z', viewUrl: 'https://drive.google.com/file/d/1zwyuTvfTwhHvIlcZTT1E0vFjzT6OEOU3/view', folderPath: 'Recording BTS' },
  { id: '1OI7lIDwfsVcyTbpcIGaxzXXApdbkcnmy', title: 'COUNTRY MUSIC SUBTITLED.mp4', mimeType: 'video/mp4', fileSize: '245045023', modifiedTime: '2026-06-01T12:03:20.504Z', viewUrl: 'https://drive.google.com/file/d/1OI7lIDwfsVcyTbpcIGaxzXXApdbkcnmy/view', folderPath: 'Recording BTS' },
  { id: '1hE3ZrptIVt2CxhsO7BfefrgUAe0xHoH4', title: 'GREENMYRE BOYS BUILD STUDIO.mp4', mimeType: 'video/mp4', fileSize: '1327895069', modifiedTime: '2026-06-01T11:24:32.279Z', viewUrl: 'https://drive.google.com/file/d/1hE3ZrptIVt2CxhsO7BfefrgUAe0xHoH4/view', folderPath: 'Recording BTS' },

  // ── Shorts / Studio BTS (vertical-friendly short clips) ──
  { id: '1bxIXNt77ij7rgEmGNSg9OwLl0lX7Pvkj', title: 'C4_Migration.mp4', mimeType: 'video/mp4', fileSize: '29177976', modifiedTime: '2026-06-02T09:35:48.545Z', viewUrl: 'https://drive.google.com/file/d/1bxIXNt77ij7rgEmGNSg9OwLl0lX7Pvkj/view', folderPath: 'Shorts / Studio BTS' },
  { id: '1CFgCfjJL9s9xISv5kBZGvVtnihgTYYgZ', title: 'C5_Migration.mp4', mimeType: 'video/mp4', fileSize: '27936482', modifiedTime: '2026-06-02T09:36:51.175Z', viewUrl: 'https://drive.google.com/file/d/1CFgCfjJL9s9xISv5kBZGvVtnihgTYYgZ/view', folderPath: 'Shorts / Studio BTS' },
  { id: '1MHlB5ItzIO-ItVURVtM-HRk2cwGxeTeL', title: 'C6_Migration.mp4', mimeType: 'video/mp4', fileSize: '31086691', modifiedTime: '2026-06-02T09:37:55.116Z', viewUrl: 'https://drive.google.com/file/d/1MHlB5ItzIO-ItVURVtM-HRk2cwGxeTeL/view', folderPath: 'Shorts / Studio BTS' },

  // ── Live Vlogs ──
  { id: '1BN9JyJxYX5PlTkl1OfmcL2Vr5oVdhvt7', title: 'DAY IN THE LIFE - INHALER.mp4', mimeType: 'video/mp4', fileSize: '602042866', modifiedTime: '2026-06-01T12:45:19.767Z', viewUrl: 'https://drive.google.com/file/d/1BN9JyJxYX5PlTkl1OfmcL2Vr5oVdhvt7/view', folderPath: 'Live Vlogs' },
  { id: '1MxIDusgaF88okgZBFzo9Uhyml4G_lsRL', title: 'BANDYCAM EPISODE #1 HYDRO.mp4', mimeType: 'video/mp4', fileSize: '147125729', modifiedTime: '2026-06-01T12:05:43.287Z', viewUrl: 'https://drive.google.com/file/d/1MxIDusgaF88okgZBFzo9Uhyml4G_lsRL/view', folderPath: 'Live Vlogs' },
  { id: '13cMHku2J1DThw_pItwC87hzCiujKHJ8Z', title: 'Barras_N1.mp4', mimeType: 'video/mp4', fileSize: '235680927', modifiedTime: '2025-07-25T13:09:43.034Z', viewUrl: 'https://drive.google.com/file/d/13cMHku2J1DThw_pItwC87hzCiujKHJ8Z/view', folderPath: 'Live Vlogs' },
  { id: '1FDnMz95YPuC2wiuugrVfLqgVfw19NOQv', title: 'Barras_N3.mp4', mimeType: 'video/mp4', fileSize: '170434153', modifiedTime: '2025-07-25T13:11:12.023Z', viewUrl: 'https://drive.google.com/file/d/1FDnMz95YPuC2wiuugrVfLqgVfw19NOQv/view', folderPath: 'Live Vlogs' },

  // ── Performances ──
  { id: '1Vz5Fm9S6G1UQ5zPOSzH_7Phl5eAOufiK', title: 'SUMMER_RAIN_ACOUSTIC_MIGRATION (1).mp4', mimeType: 'video/mp4', fileSize: '1053386480', modifiedTime: '2026-06-01T11:31:58.097Z', viewUrl: 'https://drive.google.com/file/d/1Vz5Fm9S6G1UQ5zPOSzH_7Phl5eAOufiK/view', folderPath: 'Performances' },

  // ── Audio masters ──
  { id: '12FoS-1AgOH1juBeCLBpth1fvVFHsKCiN', title: 'The Snuts - Motherlands_v2.wav', mimeType: 'audio/x-wav', fileSize: '58752094', modifiedTime: '2026-03-10T11:48:22.208Z', viewUrl: 'https://drive.google.com/file/d/12FoS-1AgOH1juBeCLBpth1fvVFHsKCiN/view', folderPath: 'Masters' },
];

export const SNUTS_CONFIG: CampaignConfig = {
  slug: 'the-snuts-the-snuts-campaign',
  artist: 'The Snuts',
  driveFolderUrl: FOLDER_URL,
  driveFolderName: 'The Snuts — All Content',
  seedFolderId: '12bu-JmSvWfa-fgUUSm256o0GUToqWxhj',
  seedScannedAt: '2026-06-02T13:00:00.000Z',
  seedAssetFiles: FILES,
  knownReleases: [
    { title: 'Summer Rain', type: 'single' },
    { title: 'Motherlands', type: 'single' },
  ],
  campaignMilestones: [
    { label: 'Summer Rain — single', kind: 'singleRelease' },
    { label: 'Migration — album', kind: 'albumRelease' },
  ],
  // BTS-heavy campaign: standard release expectations are fine — we want the
  // score to honestly flag the missing official video + artwork.
};
