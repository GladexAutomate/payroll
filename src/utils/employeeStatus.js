export const isNotResigned = (employee) => {
  const status = employee?.status || employee?.fields?.Status || employee?.data?.status || employee?.data?.fields?.Status || '';
  return String(status).trim().toLowerCase() !== 'resigned';
};