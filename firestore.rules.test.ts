/**
 * Security Rules Verification Spec ("Dirty Dozen" Payloads)
 * Reference test suite documenting expected PERMISSION_DENIED outcomes
 * against @firebase/rules-unit-testing for GuruMapel LMS.
 */

export const DIRTY_DOZEN_CASES = [
  {
    name: '1. Unauthenticated read on /classes/c1',
    auth: null,
    op: 'get',
    path: '/classes/c1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Unverified email create on /submissions/sub_1',
    auth: { uid: 'stu_1', email: 'siswa@example.com', email_verified: false },
    op: 'create',
    path: '/submissions/sub_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Self-assigned admin escalation on /admins/stu_1',
    auth: { uid: 'stu_1', email: 'siswa@example.com', email_verified: true },
    op: 'create',
    path: '/admins/stu_1',
    payload: { email: 'siswa@example.com', addedByUid: 'stu_1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Admin email spoof with unverified token',
    auth: { uid: 'att_1', email: 'robisaiful@gmail.com', email_verified: false },
    op: 'create',
    path: '/classes/c_hack',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Cross-student PII read on /students/s2/private/contact',
    auth: { uid: 'stu_1', email: 'siswa1@example.com', email_verified: true },
    op: 'get',
    path: '/students/s2/private/contact',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Shadow field score injection on student submission create',
    auth: { uid: 'stu_1', email: 'siswa1@example.com', email_verified: true },
    op: 'create',
    path: '/submissions/sub_cheat',
    payload: { taskId: 't1', studentId: 's1', studentName: 'Ani', studentUid: 'stu_1', score: 100 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Student self-grading update on /submissions/sub_1',
    auth: { uid: 'stu_1', email: 'siswa1@example.com', email_verified: true },
    op: 'update',
    path: '/submissions/sub_1',
    payload: { score: 100 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Orphaned submission referencing missing taskId',
    auth: { uid: 'stu_1', email: 'siswa1@example.com', email_verified: true },
    op: 'create',
    path: '/submissions/sub_orphan',
    payload: { taskId: 'missing_task', studentId: 's1', studentName: 'Ani', studentUid: 'stu_1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Oversized invalid document ID (>128 chars)',
    auth: { uid: 'stu_1', email: 'siswa1@example.com', email_verified: true },
    op: 'get',
    path: `/tasks/${'a'.repeat(200)}`,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Oversized workText (>20000 chars) on submission',
    auth: { uid: 'stu_1', email: 'siswa1@example.com', email_verified: true },
    op: 'create',
    path: '/submissions/sub_big',
    payload: { workText: 'x'.repeat(25000) },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Forged createdAt timestamp instead of server request.time',
    auth: { uid: 'admin_1', email: 'robisaiful@gmail.com', email_verified: true },
    op: 'create',
    path: '/classes/c_forged',
    payload: { name: 'X-9', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Student reading teacher AI questionSets with answer keys',
    auth: { uid: 'stu_1', email: 'siswa1@example.com', email_verified: true },
    op: 'get',
    path: '/questionSets/qset_1',
    expected: 'PERMISSION_DENIED',
  },
];
