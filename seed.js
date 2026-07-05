require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./src/models/Category');
const PublishPackage = require('./src/models/PublishPackage');
const User = require('./src/models/User');
const connectDB = require('./src/config/database');

const seedData = async () => {
  try {
    await connectDB();

    console.log('Seeding Data...');

    // 1. Seed Categories
    await Category.deleteMany();
    const categories = await Category.insertMany([
      { name: 'Fiction', slug: 'fiction', description: 'Fictional stories and novels.' },
      { name: 'Non-Fiction', slug: 'non-fiction', description: 'Factual and informative books.' },
      { name: 'Sci-Fi & Fantasy', slug: 'sci-fi-fantasy', description: 'Science fiction and fantasy.' },
      { name: 'Romance', slug: 'romance', description: 'Romance novels.' },
      { name: 'Self-Help', slug: 'self-help', description: 'Personal development.' }
    ]);
    console.log('Categories seeded.');

    // 2. Seed Publish Packages
    await PublishPackage.deleteMany();
    await PublishPackage.insertMany([
      {
        name: 'Basic',
        description: 'Standard publishing package with basic formatting.',
        price: 4999,
        features: ['Basic Formatting', 'ISBN Assignment', 'Standard Cover Design']
      },
      {
        name: 'Premium',
        description: 'Advanced publishing package with marketing support.',
        price: 14999,
        features: ['Professional Editing', 'Premium Cover Design', 'Social Media Marketing', 'ISBN Assignment']
      }
    ]);
    console.log('Publish Packages seeded.');

    // 3. Create an Admin User (if none exists)
    const adminExists = await User.findOne({ email: 'admin@harglim.com' });
    if (!adminExists) {
      await User.create({
        name: 'Admin User',
        email: 'admin@harglim.com',
        password: 'password123',
        role: 'admin'
      });
      console.log('Admin user created (admin@harglim.com / password123).');
    }

    console.log('Seeding completed successfully!');
    process.exit();
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
