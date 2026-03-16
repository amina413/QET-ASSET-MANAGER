import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding users...');

    // Hash password using bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    const users = [
        { name: 'Amina Yusuf', email: 'admin@abdc.com', department: 'IT', role: 'SYSTEM_ADMIN' },
        { name: 'Tunde Bakare', email: 'manager@abdc.com', department: 'Finance', role: 'ASSET_MANAGER' },
        { name: 'Emeka Okafor', email: 'emeka@abdc.com', department: 'Operations', role: 'CUSTODIAN' },
        { name: 'Chioma Obi', email: 'audit@abdc.com', department: 'Internal Audit', role: 'AUDITOR' },
        { name: 'Okalu', email: 'okalu@abdc.com', department: 'Administration', role: 'SYSTEM_ADMIN', password: 'Okalu25428056' },
    ];

    for (const u of users) {
        const passwordToHash = u.password || 'password123';
        const userPassword = await bcrypt.hash(passwordToHash, salt);

        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: {
                password: userPassword
            },
            create: {
                name: u.name,
                email: u.email,
                department: u.department,
                role: u.role,
                password: userPassword,
                lastLogin: new Date(),
            },
        });
        console.log(`Created/Updated user: ${user.name} (${user.role})`);
    }

    console.log('Start seeding departments...');
    const departments = [
        { name: 'Tax', code: 'TAX', location: 'Abuja' },
        { name: 'Advisory', code: 'ADV', location: 'Abuja' },
        { name: 'Audit and Assurance', code: 'AA', location: 'Abuja' },
        { name: 'Shared Services', code: 'SS', location: 'Abuja' },
        { name: 'Tax', code: 'TAX-KD', location: 'Kaduna' },
        { name: 'Advisory', code: 'ADV-KD', location: 'Kaduna' },
        { name: 'Audit and Assurance', code: 'AA-KD', location: 'Kaduna' },
        { name: 'Shared Services', code: 'SS-KD', location: 'Kaduna' },
    ];

    for (const dept of departments) {
        const department = await prisma.department.upsert({
            where: { code: dept.code },
            update: {},
            create: dept,
        });
        console.log(`Created/Updated department: ${department.name} (${department.code})`);
    }

    console.log('Start seeding locations...');
    const locations = [
        { name: 'Abuja', code: 'ABJ' },
        { name: 'Kaduna', code: 'KAD' },
    ];

    for (const loc of locations) {
        const location = await prisma.location.upsert({
            where: { code: loc.code },
            update: {},
            create: loc,
        });
        console.log(`Created/Updated location: ${location.name} (${location.code})`);
    }

    console.log('Start seeding custodians...');
    const custodians = [
        { name: 'Emeka Okafor', department: 'IT', location: 'Abuja', email: 'emeka@abdc.com', phone: '+234 803 123 4567' },
        { name: 'Transport Pool', department: 'Shared Services', location: 'Abuja', email: 'transport@abdc.com', phone: '+234 803 234 5678' },
        { name: 'Facilities Manager', department: 'Shared Services', location: 'Abuja', email: 'facilities@abdc.com', phone: '+234 803 345 6789' },
        { name: 'IT Director', department: 'IT', location: 'Abuja', email: 'it.director@abdc.com', phone: '+234 803 456 7890' },
        { name: 'Office Manager', department: 'Shared Services', location: 'Kaduna', email: 'office.kaduna@abdc.com', phone: '+234 803 567 8901' },
        { name: 'Logistics Officer', department: 'Shared Services', location: 'Kaduna', email: 'logistics@abdc.com', phone: '+234 803 678 9012' },
    ];

    for (const cust of custodians) {
        const custodian = await prisma.custodian.create({
            data: cust,
        });
        console.log(`Created custodian: ${custodian.name}`);
    }

    console.log('Start seeding categories...');
    const categoryNames = ['IT Equipment', 'Office Equipment', 'Motor Vehicles', 'Furniture and Fittings', 'Plant and Machinery', 'Land & Buildings', 'Software Licenses'];
    const categoryCodes = ['ITE', 'OE', 'VH', 'FAF', 'PMA', 'LND', 'SL'];
    for (let i = 0; i < categoryNames.length; i++) {
        await prisma.category.upsert({
            where: { name: categoryNames[i] },
            update: {},
            create: { name: categoryNames[i], code: categoryCodes[i], sortOrder: i },
        });
    }
    console.log('Start seeding asset classes and custodian options...');
    const gp = await prisma.assetClass.upsert({
        where: { name: 'General Purpose' },
        update: {},
        create: { name: 'General Purpose', sortOrder: 0 },
    });
    const cluster = await prisma.assetClass.upsert({
        where: { name: 'Cluster' },
        update: {},
        create: { name: 'Cluster', sortOrder: 1 },
    });
    const gpOptions = ['HR/Admin', 'Manager Training Hub', 'Individual'];
    for (let i = 0; i < gpOptions.length; i++) {
        const name = gpOptions[i];
        const existing = await prisma.custodianOption.findFirst({ where: { assetClassId: gp.id, name } });
        if (!existing) await prisma.custodianOption.create({ data: { assetClassId: gp.id, name, sortOrder: i } });
    }
    const clusterOptions = ["Chairman's Secretary 3.01", 'MP Advisory 2.04', 'Dir Shared Services 2.02', 'MP Audit and Assurance 2.03'];
    for (let i = 0; i < clusterOptions.length; i++) {
        const name = clusterOptions[i];
        const existing = await prisma.custodianOption.findFirst({ where: { assetClassId: cluster.id, name } });
        if (!existing) await prisma.custodianOption.create({ data: { assetClassId: cluster.id, name, sortOrder: i } });
    }
    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
